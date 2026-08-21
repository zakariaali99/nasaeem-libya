'use client';

import React, { ReactNode } from 'react';
import { AlignCenterIcon } from 'lucide-react';
import {
  MDXEditor,
  toolbarPlugin,
  UndoRedo,
  BoldItalicUnderlineToggles,
  ListsToggle,
  StrikeThroughSupSubToggles,
  CodeToggle,
  BlockTypeSelect,
  InsertTable,
  InsertThematicBreak,
  CreateLink,
  InsertCodeBlock,
  headingsPlugin,
  quotePlugin,
  listsPlugin,
  linkPlugin,
  linkDialogPlugin,
  codeBlockPlugin,
  tablePlugin,
  thematicBreakPlugin,
  directivesPlugin,
  insertDirective$,
  GenericDirectiveEditor,
  usePublisher,
  DialogButton,
  Button,
} from '@mdxeditor/editor';
import '@mdxeditor/editor/style.css';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkDirective from 'remark-directive';
import rehypeRaw from 'rehype-raw';
import { visit } from 'unist-util-visit';
import { toString } from 'mdast-util-to-string';
import type { DirectiveDescriptor } from '@mdxeditor/editor';

// Define directive descriptors
const CenterDirectiveDescriptor: DirectiveDescriptor = {
  name: 'center',
  testNode: (node) => node.name === 'center',
  attributes: [],
  hasChildren: true,
  Editor: GenericDirectiveEditor,
};
const FontSizeDirectiveDescriptor: DirectiveDescriptor = {
  name: 'fontsize',
  testNode: (node) => node.name === 'fontsize',
  attributes: ['size'],
  hasChildren: true, // now container directive
  Editor: GenericDirectiveEditor,
};

// Toolbar buttons for directives
const InsertCenterButton: React.FC = () => {
  const insert = usePublisher(insertDirective$);
  return (
    <Button
      onClick={() => {
        insert({
          name: 'center',
          type: 'containerDirective',
          attributes: {},
          children: [{ type: 'text', value: 'نص في الوسط' }],
        } as any);
      }}
    >
      <AlignCenterIcon className="w-6 h-6" />
    </Button>
  );
};
const InsertFontSizeButton: React.FC = () => {
  const insert = usePublisher(insertDirective$);
  return (
    <Button
      onClick={() => {
        insert({
          name: 'fontsize',
          type: 'containerDirective',
          attributes: { size: 'inherit' }, // default size
          children: [],
        } as any);
      }}
    >
        حجم الخط
    </Button>
  );
};

interface TextBlockEditorProps {
  value: string;
  onChange: (markdown: string) => void;
}

export const TextBlockEditor: React.FC<TextBlockEditorProps> = ({ value, onChange }) => {
  return (
    <div className="space-y-2" dir="rtl">
      <div style={{ maxHeight: 200, overflowY: 'auto' }}>
        {/* Editor with directives and toolbar plugins */}
        <MDXEditor
          markdown={value || ''}
          onChange={onChange}
          plugins={[
            directivesPlugin({ directiveDescriptors: [CenterDirectiveDescriptor, FontSizeDirectiveDescriptor] }),
            toolbarPlugin({
              toolbarContents: () => (
                <>
                  <UndoRedo />
                  <BoldItalicUnderlineToggles />
                  <ListsToggle />
                  <StrikeThroughSupSubToggles />
                  <CodeToggle />
                  <BlockTypeSelect />
                  <InsertTable />
                  <InsertThematicBreak />
                  <CreateLink />
                  <InsertCodeBlock />
                  <InsertCenterButton />
                  <InsertFontSizeButton />
                </>
              ),
            }),
            headingsPlugin(),
            quotePlugin(),
            listsPlugin(),
            linkPlugin(),
            linkDialogPlugin(),
            codeBlockPlugin(),
            tablePlugin(),
            thematicBreakPlugin(),
          ]}
        />
      </div>
    </div>
  );
};

interface TextBlockPreviewProps {
  value: string;
}

// Plugin: transform directives into HTML for preview
function remarkDirectiveToHtml() {
  return (tree: any) => {
    visit(tree, 'containerDirective', (node: any, index: number | undefined, parent: any) => {
      if (!parent || typeof index !== 'number') return;
      let openTag = '';
      let closeTag = '';
      if (node.name === 'center') {
        openTag = '<div style="text-align:center">';
        closeTag = '</div>';
      } else if (node.name === 'fontsize') {
        const size = node.attributes?.size || 'inherit';
        openTag = `<span style="font-size:${size}px">`;
        closeTag = '</span>';
      } else {
        return;
      }
      const newNodes = [
        { type: 'html', value: openTag },
        ...node.children,
        { type: 'html', value: closeTag },
      ];
      parent.children.splice(index, 1, ...newNodes);
    });
  };
}

export const TextBlockPreview: React.FC<TextBlockPreviewProps> = ({ value }) => (
  <div className="prose prose-sm text-right" dir="rtl">
    <ReactMarkdown
      // Parse directives before GFM and render HTML
      remarkPlugins={[remarkDirective, remarkDirectiveToHtml, remarkGfm]}
      rehypePlugins={[rehypeRaw]}
    >
      {value || ''}
    </ReactMarkdown>
  </div>
);

// Removed custom components since directives are converted to HTML via remarkDirectiveToHtml
