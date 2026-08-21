
import { TextBlockPreview } from '@/components/admin/customization/TextBlockComponents';

interface ProductDescriptionProps {
    description: string | null;
}

export function ProductDescription({ description }: ProductDescriptionProps) {
    if (!description) return null;

    return (
        <div className="space-y-4">
            <h3 className="text-xl font-bold">الوصف</h3>
            <div className="prose prose-stone dark:prose-invert max-w-none text-muted-foreground leading-relaxed">
                <TextBlockPreview value={description} />
            </div>
        </div>
    );
}
