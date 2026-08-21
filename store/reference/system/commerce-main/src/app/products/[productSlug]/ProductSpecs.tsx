
import { Table, TableBody, TableRow, TableCell } from '@/components/ui/table';
import { Product } from '@/modules/products/types/productTypes';

interface ProductSpecsProps {
    product: Product;
}

export function ProductSpecs({ product }: ProductSpecsProps) {
    if (product.width == null && product.length == null && product.height == null && product.weight == null) {
        return null;
    }

    return (
        <div className="space-y-4">
            <h3 className="text-xl font-bold">المواصفات التقنية</h3>
            <div className="rounded-lg border bg-card">
                <Table>
                    <TableBody>
                        {product.width != null && (
                            <TableRow>
                                <TableCell className="font-medium text-muted-foreground">العرض</TableCell>
                                <TableCell className="text-right font-semibold">{product.width} سم</TableCell>
                            </TableRow>
                        )}
                        {product.length != null && (
                            <TableRow>
                                <TableCell className="font-medium text-muted-foreground">الطول</TableCell>
                                <TableCell className="text-right font-semibold">{product.length} سم</TableCell>
                            </TableRow>
                        )}
                        {product.height != null && (
                            <TableRow>
                                <TableCell className="font-medium text-muted-foreground">الارتفاع</TableCell>
                                <TableCell className="text-right font-semibold">{product.height} سم</TableCell>
                            </TableRow>
                        )}
                        {product.weight != null && (
                            <TableRow>
                                <TableCell className="font-medium text-muted-foreground">الوزن</TableCell>
                                <TableCell className="text-right font-semibold">{product.weight} كجم</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
