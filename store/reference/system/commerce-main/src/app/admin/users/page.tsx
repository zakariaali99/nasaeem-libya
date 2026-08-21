"use client";
import React, { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client"
import { User, columns } from "./columns"
import { DataTable } from "./data-table"
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { BanUserDialog, DeleteUserDialog, ChangeRoleDialog, UnbanUserDialog } from "./user-dialogs";

interface QueryParams {
  searchValue?: string;
  searchOperator?: string;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortDirection?: "asc" | "desc";
  filterField?: string;
  filterOperator?: string;
  filterValue?: string;
}

// Helper to parse URL parameters into QueryParams
function parseURLParams(searchParams: URLSearchParams): QueryParams {
  return {
    searchValue: searchParams.get('search') || undefined,
    searchOperator: searchParams.get('searchOp') || undefined,
    limit: searchParams.has('limit') ? Number(searchParams.get('limit')) : 10,
    offset: searchParams.has('offset') ? Number(searchParams.get('offset')) : 0,
    sortBy: searchParams.get('sortBy') || undefined,
    sortDirection: (searchParams.get('sortDir') as "asc" | "desc") || undefined,
    filterField: searchParams.get('filterField') || undefined,
    filterOperator: searchParams.get('filterOp') || undefined,
    filterValue: searchParams.get('filterValue') || undefined,
  };
}

async function getData(queryParams: QueryParams): Promise<{ users: User[], totalCount: number | undefined }> {
  const users = await authClient.admin.listUsers({
    query: {
      searchValue: queryParams.searchValue,
      searchOperator: queryParams.searchOperator as any,
      limit: queryParams.limit || 10,
      offset: queryParams.offset || 0,
      sortBy: queryParams.sortBy,
      sortDirection: queryParams.sortDirection as any,
      filterField: queryParams.filterField,
      filterOperator: queryParams.filterOperator as any,
      filterValue: queryParams.filterValue,
    }
  });

  return {
    users: users.data?.users?.map((user) => ({
      id: user.id,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
      banned: user.banned
    }) as User) || [],
    totalCount: users.data?.total ?? users.data?.users.length
  };
}

function UsersTable() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();

  // Dialog states
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; user: User | null }>({ open: false, user: null });
  const [banDialog, setBanDialog] = useState<{ open: boolean; user: User | null }>({ open: false, user: null });
  const [unbanDialog, setUnbanDialog] = useState<{ open: boolean; user: User | null }>({ open: false, user: null });
  const [roleDialog, setRoleDialog] = useState<{ open: boolean; user: User | null }>({ open: false, user: null });

  // Loading states
  const [isDeleting, setIsDeleting] = useState(false);
  const [isBanning, setIsBanning] = useState(false);
  const [isUnbanning, setIsUnbanning] = useState(false);
  const [isChangingRole, setIsChangingRole] = useState(false);

  // Parse initial query params from URL
  const initialQueryParams = React.useMemo(() =>
    parseURLParams(searchParams), [searchParams]);

  const [queryParams, setQueryParams] = React.useState<QueryParams>(initialQueryParams);

  // Update URL when query params change
  React.useEffect(() => {
    const params = new URLSearchParams();

    if (queryParams.searchValue) params.set('search', queryParams.searchValue);
    if (queryParams.searchOperator) params.set('searchOp', queryParams.searchOperator);
    if (queryParams.limit) params.set('limit', queryParams.limit.toString());
    if (queryParams.offset) params.set('offset', queryParams.offset.toString());
    if (queryParams.sortBy) params.set('sortBy', queryParams.sortBy);
    if (queryParams.sortDirection) params.set('sortDir', queryParams.sortDirection);
    if (queryParams.filterField) params.set('filterField', queryParams.filterField);
    if (queryParams.filterOperator) params.set('filterOp', queryParams.filterOperator);
    if (queryParams.filterValue) params.set('filterValue', queryParams.filterValue);

    // Calculate current page for better UX in URL
    if (queryParams.limit && queryParams.offset !== undefined) {
      const page = Math.floor(queryParams.offset / queryParams.limit) + 1;
      params.set('page', page.toString());
    }

    const newURL = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    router.push(newURL, { scroll: false });
  }, [queryParams, pathname, router]);

  // Listen for user action events
  useEffect(() => {
    const handleDeleteUser = (event: CustomEvent<User>) => {
      setDeleteDialog({ open: true, user: event.detail });
    };

    const handleBanUser = (event: CustomEvent<User>) => {
      setBanDialog({ open: true, user: event.detail });
    };

    const handleUnbanUser = (event: CustomEvent<User>) => {
      setUnbanDialog({ open: true, user: event.detail });
    };

    const handleChangeRole = (event: CustomEvent<User>) => {
      setRoleDialog({ open: true, user: event.detail });
    };

    document.addEventListener("user:delete", handleDeleteUser as EventListener);
    document.addEventListener("user:ban", handleBanUser as EventListener);
    document.addEventListener("user:unban", handleUnbanUser as EventListener);
    document.addEventListener("user:change-role", handleChangeRole as EventListener);

    return () => {
      document.removeEventListener("user:delete", handleDeleteUser as EventListener);
      document.removeEventListener("user:ban", handleBanUser as EventListener);
      document.removeEventListener("user:unban", handleUnbanUser as EventListener);
      document.removeEventListener("user:change-role", handleChangeRole as EventListener);
    };
  }, []);

  // Handlers for user actions
  const handleDeleteUser = async (userId: string) => {
    try {
      setIsDeleting(true);
      await authClient.admin.removeUser({
        userId,
      });

      // Refresh the data
      queryClient.invalidateQueries({ queryKey: ["users"] });
    } catch (error) {
      console.error("Error deleting user:", error);
    } finally {
      setIsDeleting(false);
      setDeleteDialog({ open: false, user: null });
    }
  };

  const handleBanUser = async (userId: string, banReason: string, banExpiresIn: number | null) => {
    try {
      setIsBanning(true);
      await authClient.admin.banUser({
        userId,
        banReason,
        banExpiresIn: banExpiresIn || undefined,
      });

      // Refresh the data
      queryClient.invalidateQueries({ queryKey: ["users"] });
    } catch (error) {
      console.error("Error banning user:", error);
    } finally {
      setIsBanning(false);
      setBanDialog({ open: false, user: null });
    }
  };

  const handleUnbanUser = async (userId: string) => {
    try {
      setIsUnbanning(true);
      await authClient.admin.unbanUser({
        userId,
      });

      // Refresh the data
      queryClient.invalidateQueries({ queryKey: ["users"] });
    } catch (error) {
      console.error("Error unbanning user:", error);
    } finally {
      setIsUnbanning(false);
      setUnbanDialog({ open: false, user: null });
    }
  };

  const handleChangeRole = async (userId: string, newRole: string) => {
    try {
      setIsChangingRole(true);
      await authClient.admin.setRole({
        userId,
        role: newRole,
      });

      // Refresh the data
      queryClient.invalidateQueries({ queryKey: ["users"] });
    } catch (error) {
      console.error("Error changing user role:", error);
    } finally {
      setIsChangingRole(false);
      setRoleDialog({ open: false, user: null });
    }
  };

  // Memoize this function to prevent recreation on every render
  const handleQueryChange = useCallback((newParams: QueryParams) => {
    setQueryParams(prev => ({ ...prev, ...newParams }));
  }, []);

  const { data, isLoading, error } = useQuery({
    queryKey: ["users", queryParams],
    queryFn: () => getData(queryParams),
  });

  if (error) {
    return <div className="container mx-auto py-10 text-right">حدث خطأ: {(error as Error).message}</div>;
  }

  return (
    <div className="container mx-auto py-10 text-right">
      <h1 className="text-2xl font-bold mb-6">إدارة المستخدمين</h1>
      <DataTable
        columns={columns}
        data={data?.users || []}
        onQueryChange={handleQueryChange}
        totalCount={data?.totalCount || 0}
        isLoading={isLoading}
        initialParams={initialQueryParams}
      />

      {/* User Action Dialogs */}
      <DeleteUserDialog
        isOpen={deleteDialog.open}
        user={deleteDialog.user}
        isDeleting={isDeleting}
        onClose={() => setDeleteDialog({ open: false, user: null })}
        onConfirm={handleDeleteUser}
      />

      <BanUserDialog
        isOpen={banDialog.open}
        user={banDialog.user}
        isBanning={isBanning}
        onClose={() => setBanDialog({ open: false, user: null })}
        onConfirm={handleBanUser}
      />

      <UnbanUserDialog
        isOpen={unbanDialog.open}
        user={unbanDialog.user}
        isUnbanning={isUnbanning}
        onClose={() => setUnbanDialog({ open: false, user: null })}
        onConfirm={handleUnbanUser}
      />

      <ChangeRoleDialog
        isOpen={roleDialog.open}
        user={roleDialog.user}
        isChanging={isChangingRole}
        onClose={() => setRoleDialog({ open: false, user: null })}
        onConfirm={handleChangeRole}
      />
    </div>
  );
}

export default function UsersPage() {
  return (
    <React.Suspense fallback={<div className="container mx-auto py-10 text-right">جاري التحميل...</div>}>
      <UsersTable />
    </React.Suspense>
  );
}
