"use client"

import { ColumnDef } from "@tanstack/react-table"
import { MoreHorizontal, Ban, UserCheck, Trash2, UserCog } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { formatDate } from "@/lib/utils"
import Link from "next/link"

// Define the User type
export type User = {
  id: string
  name: string | null
  role: string
  createdAt: string
  banned?: boolean
}

// Define the columns
export const columns: ColumnDef<User>[] = [
  {
    id: "id",
    accessorKey: "id",
    header: "المعرف",
    enableHiding: true,
    meta: { hidden: true },
    enableColumnFilter: false,
    enableGlobalFilter: false,
    enableSorting: false,
  },
  {
    accessorKey: "name",
    header: "الاسم",
    cell: ({ row }) => {
      const user = row.original
      
      return (
        <Link 
          href={`/admin/users/${user.id}`} 
          className="text-primary hover:underline font-medium"
        >
          {user.name}
        </Link>
      )
    },
  },
  {
    accessorKey: "role",
    header: "الدور",
  },
  {
    accessorKey: "createdAt",
    header: "تاريخ التسجيل",
    cell: ({ row }) => formatDate(row.getValue("createdAt")),
  },
  {
    id: "actions",
    header: "الإجراءات",
    cell: ({ row }) => {
      const user = row.original

      return (
        <DropdownMenu dir="rtl">
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">فتح القائمة</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>الإجراءات</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => document.dispatchEvent(
                new CustomEvent("user:change-role", { detail: user })
              )}
            >
              <UserCog className="ml-2 h-4 w-4" />
              <span>تغيير الدور</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => document.dispatchEvent(
                new CustomEvent(user.banned ? "user:unban" : "user:ban", { detail: user })
              )}
              className={user.banned ? "text-green-600" : "text-orange-600"}
            >
              {user.banned ? (
                <>
                  <UserCheck className="ml-2 h-4 w-4" />
                  <span>إلغاء الحظر</span>
                </>
              ) : (
                <>
                  <Ban className="ml-2 h-4 w-4" />
                  <span>حظر المستخدم</span>
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => document.dispatchEvent(
                new CustomEvent("user:delete", { detail: user })
              )}
              className="text-red-600"
            >
              <Trash2 className="ml-2 h-4 w-4" />
              <span>حذف المستخدم</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]