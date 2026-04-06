"use client";

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { NodeViewWrapper, NodeViewProps, ReactNodeViewRenderer } from '@tiptap/react';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import { Extension, Mark, Node } from '@tiptap/core';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Quote,
  Code,
  Undo,
  Redo,
  Link as LinkIcon,
  Image as ImageIcon,
  Table as TableIcon,
  Palette,
  Highlighter,
  Heading1,
  Heading2,
  Heading3,
  Type,
  Minus,
  Upload,
  ChevronDown,
  Square,
  Circle,
  CornerUpLeft
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useState, useRef, useEffect } from 'react';
import { PlaceholderHelper } from './placeholder-helper';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import logger from '@/lib/logger';

// Custom Font Size Extension
const FontSize = Extension.create({
  name: 'fontSize',

  addGlobalAttributes() {
    return [
      {
        types: ['textStyle'],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: element => element.style.fontSize,
            renderHTML: attributes => {
              if (!attributes.fontSize) {
                return {}
              }
              return {
                style: `font-size: ${attributes.fontSize}`,
              }
            },
          },
        },
      },
    ]
  },

  addCommands() {
    return {
      setFontSize: (fontSize: string) => ({ commands }) => {
        return commands.setMark('textStyle', { fontSize })
      },
      unsetFontSize: () => ({ commands }) => {
        return commands.unsetMark('textStyle')
      },
    }
  },
});

// Custom Resizable Image Extension
const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: element => element.style.width,
        renderHTML: attributes => {
          if (!attributes.width) {
            return {}
          }
          return {
            style: `width: ${attributes.width}`,
          }
        },
      },
      height: {
        default: null,
        parseHTML: element => element.style.height,
        renderHTML: attributes => {
          if (!attributes.height) {
            return {}
          }
          return {
            style: `height: ${attributes.height}`,
          }
        },
      },
    }
  },

  addCommands() {
    return {
      ...this.parent?.(),
      setImageSize: (width: string, height: string) => ({ commands }: any) => {
        return commands.updateAttributes('image', { width, height })
      },
    }
  },
});



interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  uploadedImages?: string[];
}

const MenuBar = ({ editor, fileInputRef, onChange, uploadedImages = [] }: { editor: any; fileInputRef: React.RefObject<HTMLInputElement | null>; onChange: (content: string) => void; uploadedImages?: string[] }) => {
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [showImageInput, setShowImageInput] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [textColor, setTextColor] = useState('#000000');
  const [backgroundColor, setBackgroundColor] = useState('#ffffff');
  const [fontSize, setFontSize] = useState('16px');
  const [showButtonDialog, setShowButtonDialog] = useState(false);
  const [buttonText, setButtonText] = useState("");
  const [buttonUrl, setButtonUrl] = useState("");
  const [buttonBgColor, setButtonBgColor] = useState("#667eea");
  const [buttonTextColor, setButtonTextColor] = useState("#ffffff");
  const [borderRadius, setBorderRadius] = useState("6px");
  const [isEditingButton, setIsEditingButton] = useState(false);
  const [editingButtonElement, setEditingButtonElement] = useState<HTMLElement | null>(null);

  const insertPlaceholder = (placeholder: string) => {
    editor.chain().focus().insertContent(`{{${placeholder}}}`).run();
  };

  if (!editor) {
    return null;
  }

  const addLink = () => {
    if (linkUrl) {
      editor.chain().focus().extendMarkRange('link').setLink({ href: linkUrl }).run();
      setLinkUrl('');
      setShowLinkInput(false);
    }
  };

  const addImage = () => {
    if (imageUrl) {
      editor.chain().focus().setImage({ src: imageUrl }).run();
      setImageUrl('');
      setShowImageInput(false);
    }
  };

  const addTable = () => {
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  };

  const addButton = () => {
    if (!buttonText.trim() || !buttonUrl.trim()) {
      return;
    }

    // Create button with inline styles for email compatibility
    const buttonHTML = `<a href="${buttonUrl}" class="custom-button" style="display: inline-block; background-color: ${buttonBgColor}; color: ${buttonTextColor}; padding: 12px 24px; border-radius: 6px; text-decoration: none; border: none; cursor: pointer; font-weight: 500; text-align: center; margin: 4px 0; font-family: Arial, sans-serif; font-size: 14px;">${buttonText}</a>`;

    // Use a simple approach: insert the HTML as a text node and then manually update the content
    editor.chain().focus().insertContent(buttonHTML).run();

    // Force update the content to ensure the HTML is preserved
    setTimeout(() => {
      const currentContent = editor.getHTML();
      onChange(currentContent);
    }, 100);

    // Reset form
    setButtonText("");
    setButtonUrl("");
    setButtonBgColor("#667eea");
    setButtonTextColor("#ffffff");
    setShowButtonDialog(false);
  };

  const setBorderRadiusHandler = (radius: string) => {
    setBorderRadius(radius);
    // For now, we'll just store the radius for use when creating buttons
    // In a more complex implementation, we could modify selected elements
  };

  const setTextColorHandler = (color: string) => {
    setTextColor(color);
    editor.chain().focus().setColor(color).run();
  };

  const setBackgroundColorHandler = (color: string) => {
    setBackgroundColor(color);
    // Use highlight extension with color parameter
    if (editor.isActive('highlight')) {
      editor.chain().focus().unsetHighlight().run();
    }
    editor.chain().focus().setHighlight({ color }).run();
  };

  const setFontSizeHandler = (size: string) => {
    // Ensure size is a valid number and add 'px' if not present
    let fontSize = size;
    if (!fontSize.includes('px')) {
      const numValue = parseInt(fontSize);
      if (isNaN(numValue) || numValue < 1) {
        fontSize = '16px';
      } else if (numValue > 200) {
        fontSize = '200px';
      } else {
        fontSize = `${numValue}px`;
      }
    }
    setFontSize(fontSize);
    editor.chain().focus().setFontSize(fontSize).run();
  };

  // Remove the old fontSizes array

  return (
    <div className="rich-text-toolbar">
      <div className="flex flex-wrap gap-1 items-center">
        {/* Text Formatting */}
        <div className="flex items-center gap-1">
          <Button
            variant={editor.isActive('bold') ? 'default' : 'outline'}
            size="sm"
            onClick={() => editor.chain().focus().toggleBold().run()}
            disabled={!editor.can().chain().focus().toggleBold().run()}
            className="h-8 w-8 p-0 hover:bg-gray-200"
          >
            <Bold className="h-4 w-4" />
          </Button>
          <Button
            variant={editor.isActive('italic') ? 'default' : 'outline'}
            size="sm"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            disabled={!editor.can().chain().focus().toggleItalic().run()}
            className="h-8 w-8 p-0 hover:bg-gray-200"
          >
            <Italic className="h-4 w-4" />
          </Button>
          <Button
            variant={editor.isActive('underline') ? 'default' : 'outline'}
            size="sm"
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className="h-8 w-8 p-0 hover:bg-gray-200"
          >
            <UnderlineIcon className="h-4 w-4" />
          </Button>
          <Button
            variant={editor.isActive('strike') ? 'default' : 'outline'}
            size="sm"
            onClick={() => editor.chain().focus().toggleStrike().run()}
            className="h-8 w-8 p-0 hover:bg-gray-200"
          >
            <Strikethrough className="h-4 w-4" />
          </Button>
        </div>

        <Separator orientation="vertical" className="h-6 bg-gray-300 dark:bg-gray-600" />

        {/* Font Size */}
        <div className="flex items-center gap-1">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 px-2 hover:bg-gray-200">
                <Type className="h-4 w-4 mr-1" />
                {fontSize}
                <ChevronDown className="h-3 w-3 ml-1" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-4">
              <div className="space-y-4">
                <Label className="text-sm font-medium">Font Size</Label>

                {/* Font Size Slider */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>8px</span>
                    <span>Current: {fontSize}</span>
                    <span>72px</span>
                  </div>
                  <input
                    type="range"
                    min="8"
                    max="72"
                    step="1"
                    value={parseInt(fontSize)}
                    onChange={(e) => setFontSizeHandler(`${e.target.value}px`)}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                  />
                </div>

                {/* Custom Font Size Input */}
                <div className="flex items-center gap-2">
                  <Label className="text-xs">Custom:</Label>
                  <Input
                    type="number"
                    min="1"
                    max="200"
                    value={parseInt(fontSize)}
                    onChange={(e) => setFontSizeHandler(`${e.target.value}px`)}
                    className="w-20 h-8 text-xs"
                    placeholder="16"
                  />
                  <span className="text-xs text-muted-foreground">px</span>
                </div>

                {/* Quick Size Buttons */}
                <div className="grid grid-cols-3 gap-1">
                  {['12px', '16px', '20px', '24px', '32px', '48px'].map((size) => (
                    <Button
                      key={size}
                      variant={fontSize === size ? "default" : "outline"}
                      size="sm"
                      className="text-xs"
                      onClick={() => setFontSizeHandler(size)}
                    >
                      {size}
                    </Button>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <Separator orientation="vertical" className="h-6 bg-gray-300 dark:bg-gray-600" />

        {/* Text Color */}
        <div className="flex items-center gap-1">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 w-8 p-0 hover:bg-gray-200">
                <Palette className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-4">
              <div className="space-y-3">
                <Label className="text-sm font-medium">Text Color</Label>
                <div className="grid grid-cols-6 gap-2">
                  {['#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#ffa500', '#800080', '#008000', '#ffc0cb'].map((color) => (
                    <button
                      key={color}
                      className="color-picker-button"
                      style={{ backgroundColor: color }}
                      onClick={() => setTextColorHandler(color)}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="color"
                    value={textColor}
                    onChange={(e) => setTextColorHandler(e.target.value)}
                    className="w-12 h-8 p-1"
                  />
                  <Input
                    type="text"
                    value={textColor}
                    onChange={(e) => setTextColorHandler(e.target.value)}
                    placeholder="#000000"
                    className="flex-1 text-xs"
                  />
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Background Color */}
        <div className="flex items-center gap-1">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 w-8 p-0 hover:bg-gray-200">
                <Highlighter className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Background Color</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      editor.chain().focus().unsetHighlight().run();
                      setBackgroundColor('#ffffff');
                    }}
                    className="text-xs"
                  >
                    Clear
                  </Button>
                </div>
                <div className="grid grid-cols-6 gap-2">
                  {['#ffffff', '#000000', '#ffeb3b', '#4caf50', '#2196f3', '#ff9800', '#e91e63', '#9c27b0', '#607d8b', '#795548', '#ff5722', '#00bcd4'].map((color) => (
                    <button
                      key={color}
                      className="color-picker-button"
                      style={{ backgroundColor: color }}
                      onClick={() => setBackgroundColorHandler(color)}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="color"
                    value={backgroundColor}
                    onChange={(e) => setBackgroundColorHandler(e.target.value)}
                    className="w-12 h-8 p-1"
                  />
                  <Input
                    type="text"
                    value={backgroundColor}
                    onChange={(e) => setBackgroundColorHandler(e.target.value)}
                    placeholder="#ffffff"
                    className="flex-1 text-xs"
                  />
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <Separator orientation="vertical" className="h-6 bg-gray-300 dark:bg-gray-600" />

        {/* Headings */}
        <div className="flex items-center gap-1">
          <Button
            variant={editor.isActive('heading', { level: 1 }) ? 'default' : 'outline'}
            size="sm"
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className="h-8 w-8 p-0 hover:bg-gray-200"
          >
            <Heading1 className="h-4 w-4" />
          </Button>
          <Button
            variant={editor.isActive('heading', { level: 2 }) ? 'default' : 'outline'}
            size="sm"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className="h-8 w-8 p-0 hover:bg-gray-200"
          >
            <Heading2 className="h-4 w-4" />
          </Button>
          <Button
            variant={editor.isActive('heading', { level: 3 }) ? 'default' : 'outline'}
            size="sm"
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            className="h-8 w-8 p-0 hover:bg-gray-200"
          >
            <Heading3 className="h-4 w-4" />
          </Button>
        </div>

        <Separator orientation="vertical" className="h-6 bg-gray-300 dark:bg-gray-600" />

        {/* Text Alignment */}
        <div className="flex items-center gap-1">
          <Button
            variant={editor.isActive({ textAlign: 'left' }) ? 'default' : 'outline'}
            size="sm"
            onClick={() => editor.chain().focus().setTextAlign('left').run()}
            className="h-8 w-8 p-0 hover:bg-gray-200"
          >
            <AlignLeft className="h-4 w-4" />
          </Button>
          <Button
            variant={editor.isActive({ textAlign: 'center' }) ? 'default' : 'outline'}
            size="sm"
            onClick={() => editor.chain().focus().setTextAlign('center').run()}
            className="h-8 w-8 p-0 hover:bg-gray-200"
          >
            <AlignCenter className="h-4 w-4" />
          </Button>
          <Button
            variant={editor.isActive({ textAlign: 'right' }) ? 'default' : 'outline'}
            size="sm"
            onClick={() => editor.chain().focus().setTextAlign('right').run()}
            className="h-8 w-8 p-0 hover:bg-gray-200"
          >
            <AlignRight className="h-4 w-4" />
          </Button>
          <Button
            variant={editor.isActive({ textAlign: 'justify' }) ? 'default' : 'outline'}
            size="sm"
            onClick={() => editor.chain().focus().setTextAlign('justify').run()}
            className="h-8 w-8 p-0 hover:bg-gray-200"
          >
            <AlignJustify className="h-4 w-4" />
          </Button>
        </div>

        <Separator orientation="vertical" className="h-6 bg-gray-300 dark:bg-gray-600" />

        {/* Lists */}
        <div className="flex items-center gap-1">
          <Button
            variant={editor.isActive('bulletList') ? 'default' : 'outline'}
            size="sm"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className="h-8 w-8 p-0 hover:bg-gray-200"
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            variant={editor.isActive('orderedList') ? 'default' : 'outline'}
            size="sm"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className="h-8 w-8 p-0 hover:bg-gray-200"
          >
            <ListOrdered className="h-4 w-4" />
          </Button>
        </div>

        <Separator orientation="vertical" className="h-6 bg-gray-300 dark:bg-gray-600" />

        {/* Block Elements */}
        <div className="flex items-center gap-1">
          <Button
            variant={editor.isActive('blockquote') ? 'default' : 'outline'}
            size="sm"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className="h-8 w-8 p-0 hover:bg-gray-200"
          >
            <Quote className="h-4 w-4" />
          </Button>
          <Button
            variant={editor.isActive('codeBlock') ? 'default' : 'outline'}
            size="sm"
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            className="h-8 w-8 p-0 hover:bg-gray-200"
          >
            <Code className="h-4 w-4" />
          </Button>
        </div>

        <Separator orientation="vertical" className="h-6 bg-gray-300 dark:bg-gray-600" />

        {/* Links and Images */}
        <div className="flex items-center gap-1">
          <Button
            variant={editor.isActive('link') ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowLinkInput(!showLinkInput)}
            className="h-8 w-8 p-0 hover:bg-gray-200"
          >
            <LinkIcon className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0 hover:bg-gray-200"
              >
                <ImageIcon className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setShowImageInput(!showImageInput)}>
                <ImageIcon className="h-4 w-4 mr-2" />
                Insert from URL
              </DropdownMenuItem>
              {uploadedImages.length > 0 && (
                <>
                  <DropdownMenuItem disabled className="text-xs text-gray-500">
                    Uploaded Images
                  </DropdownMenuItem>
                  {uploadedImages.map((imageUrl, index) => (
                    <DropdownMenuItem
                      key={index}
                      onClick={() => {
                        editor.chain().focus().setImage({ src: imageUrl }).run();
                        onChange(editor.getHTML());
                      }}
                      className="flex items-center gap-2"
                    >
                      <img
                        src={imageUrl}
                        alt={`Uploaded image ${index + 1}`}
                        className="w-6 h-6 object-cover rounded"
                      />
                      <span className="text-xs">Image {index + 1}</span>
                    </DropdownMenuItem>
                  ))}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="h-8 w-8 p-0 hover:bg-gray-200"
          >
            <Upload className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={addTable}
            className="h-8 w-8 p-0 hover:bg-gray-200"
          >
            <TableIcon className="h-4 w-4" />
          </Button>
        </div>

        <Separator orientation="vertical" className="h-6 bg-gray-300 dark:bg-gray-600" />

        {/* History */}
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().chain().focus().undo().run()}
            className="h-8 w-8 p-0 hover:bg-gray-200"
          >
            <Undo className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().chain().focus().redo().run()}
            className="h-8 w-8 p-0 hover:bg-gray-200"
          >
            <Redo className="h-4 w-4" />
          </Button>
        </div>

        <Separator orientation="vertical" className="h-6 bg-gray-300 dark:bg-gray-600" />

        {/* Placeholder Helper */}
        <PlaceholderHelper onInsertPlaceholder={insertPlaceholder} />

        <Separator orientation="vertical" className="h-6 bg-gray-300 dark:bg-gray-600" />

        {/* Button Creation */}
        <div className="flex items-center gap-1">
          <Popover open={showButtonDialog} onOpenChange={setShowButtonDialog}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 px-2 hover:bg-gray-200">
                <Square className="h-4 w-4 mr-1" />
                Button
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-4">
              <div className="space-y-4">
                <Label className="text-sm font-medium">Create Button</Label>

                <div className="space-y-2">
                  <Label className="text-xs">Button Text</Label>
                  <Input
                    value={buttonText}
                    onChange={(e) => setButtonText(e.target.value)}
                    placeholder="Click me"
                    className="text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Button URL</Label>
                  <Input
                    value={buttonUrl}
                    onChange={(e) => setButtonUrl(e.target.value)}
                    placeholder="#"
                    className="text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <Label className="text-xs">Background Color</Label>
                    <Input
                      type="color"
                      value={buttonBgColor}
                      onChange={(e) => setButtonBgColor(e.target.value)}
                      className="w-full h-8"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Text Color</Label>
                    <Input
                      type="color"
                      value={buttonTextColor}
                      onChange={(e) => setButtonTextColor(e.target.value)}
                      className="w-full h-8"
                    />
                  </div>
                </div>

                <Button onClick={addButton} className="w-full">
                  Add Button
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Link Input */}
      {showLinkInput && (
        <div className="mt-2 p-2 bg-gray-50 rounded border">
          <div className="flex gap-2">
            <input
              type="url"
              placeholder="Enter URL..."
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              className="flex-1 px-3 py-1 border rounded text-sm"
              onKeyDown={(e) => e.key === 'Enter' && addLink()}
            />
            <Button size="sm" onClick={addLink}>Add</Button>
            <Button size="sm" variant="outline" onClick={() => setShowLinkInput(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Image Input */}
      {showImageInput && (
        <div className="mt-2 p-2 bg-gray-50 rounded border">
          <div className="flex gap-2">
            <input
              type="url"
              placeholder="Enter image URL..."
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className="flex-1 px-3 py-1 border rounded text-sm"
              onKeyDown={(e) => e.key === 'Enter' && addImage()}
            />
            <Button size="sm" onClick={addImage}>Add</Button>
            <Button size="sm" variant="outline" onClick={() => setShowImageInput(false)}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
};

export function RichTextEditor({ content, onChange, placeholder, uploadedImages = [] }: RichTextEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleFileUpload = (file: File) => {
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const imageUrl = e.target?.result as string;
        editor?.chain().focus().setImage({ src: imageUrl }).run();
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const editor = useEditor({
    extensions: [
      StarterKit,
      ResizableImage.configure({
        HTMLAttributes: {
          class: 'max-w-full h-auto',
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-600 underline cursor-pointer',
        },
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Underline,
      TextStyle,
      Color,
      Highlight.configure({
        multicolor: true,
        HTMLAttributes: {
          class: 'highlight',
        },
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      FontSize,
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-2xl mx-auto focus:outline-none max-w-none',
      },
    },
    immediatelyRender: false,
  });

  // Sync external content into the editor when templates or parent state update
  useEffect(() => {
    if (!editor) return;
    try {
      const current = editor.getHTML();
      // Only update if different to avoid cursor jumps
      if (typeof content === 'string' && content.trim() !== current.trim()) {
        editor.commands.setContent(content, { emitUpdate: false });
      }
    } catch { }
  }, [content, editor]);

  // Add image resize functionality
  useEffect(() => {
    if (!editor) return;

    const handleImageResize = () => {
      const images = document.querySelectorAll('.ProseMirror img:not([data-resize-initialized])');
      logger.info('Found images to resize:', { data: images.length });

      images.forEach((img) => {
        img.setAttribute('data-resize-initialized', 'true');

        let isResizing = false;
        let startX = 0;
        let startY = 0;
        let startWidth = 0;
        let startHeight = 0;

        // Make sure the image has a parent container
        if (!img.parentElement) return;

        // Create resize handles directly in the parent
        const handles = ['nw', 'ne', 'sw', 'se', 'n', 's', 'w', 'e'];
        handles.forEach(handle => {
          const handleEl = document.createElement('div');
          handleEl.className = `image-resize-handle ${handle}`;
          handleEl.style.display = 'none';
          handleEl.style.position = 'absolute';
          handleEl.style.zIndex = '1000';
          handleEl.style.backgroundColor = '#3b82f6';
          handleEl.style.border = '1px solid white';
          handleEl.style.borderRadius = '50%';
          handleEl.style.width = '8px';
          handleEl.style.height = '8px';
          handleEl.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.3)';

          // Position the handle
          switch (handle) {
            case 'nw':
              handleEl.style.top = '-4px';
              handleEl.style.left = '-4px';
              handleEl.style.cursor = 'nw-resize';
              break;
            case 'ne':
              handleEl.style.top = '-4px';
              handleEl.style.right = '-4px';
              handleEl.style.cursor = 'ne-resize';
              break;
            case 'sw':
              handleEl.style.bottom = '-4px';
              handleEl.style.left = '-4px';
              handleEl.style.cursor = 'sw-resize';
              break;
            case 'se':
              handleEl.style.bottom = '-4px';
              handleEl.style.right = '-4px';
              handleEl.style.cursor = 'se-resize';
              break;
            case 'n':
              handleEl.style.top = '-4px';
              handleEl.style.left = '50%';
              handleEl.style.transform = 'translateX(-50%)';
              handleEl.style.cursor = 'n-resize';
              break;
            case 's':
              handleEl.style.bottom = '-4px';
              handleEl.style.left = '50%';
              handleEl.style.transform = 'translateX(-50%)';
              handleEl.style.cursor = 's-resize';
              break;
            case 'w':
              handleEl.style.left = '-4px';
              handleEl.style.top = '50%';
              handleEl.style.transform = 'translateY(-50%)';
              handleEl.style.cursor = 'w-resize';
              break;
            case 'e':
              handleEl.style.right = '-4px';
              handleEl.style.top = '50%';
              handleEl.style.transform = 'translateY(-50%)';
              handleEl.style.cursor = 'e-resize';
              break;
          }

          if (img.parentElement) {
            img.parentElement.appendChild(handleEl);
          }
        });

        // Show handles on hover
        img.addEventListener('mouseenter', () => {
          const handleElements = img.parentElement?.querySelectorAll('.image-resize-handle');
          handleElements?.forEach(handle => {
            (handle as HTMLElement).style.display = 'block';
          });
        });

        img.addEventListener('mouseleave', () => {
          if (!isResizing) {
            const handleElements = img.parentElement?.querySelectorAll('.image-resize-handle');
            handleElements?.forEach(handle => {
              (handle as HTMLElement).style.display = 'none';
            });
          }
        });

        // Handle resize start
        const handleMouseDown = (e: MouseEvent, handle: string) => {
          e.preventDefault();
          e.stopPropagation();

          isResizing = true;
          startX = e.clientX;
          startY = e.clientY;
          startWidth = (img as HTMLElement).offsetWidth;
          startHeight = (img as HTMLElement).offsetHeight;

          img.classList.add('resizing');

          const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing) return;

            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;

            let newWidth = startWidth;
            let newHeight = startHeight;

            if (handle.includes('right') || handle.includes('e')) {
              newWidth = startWidth + deltaX;
            }
            if (handle.includes('left') || handle.includes('w')) {
              newWidth = startWidth - deltaX;
            }
            if (handle.includes('bottom') || handle.includes('s')) {
              newHeight = startHeight + deltaY;
            }
            if (handle.includes('top') || handle.includes('n')) {
              newHeight = startHeight - deltaY;
            }

            // Maintain aspect ratio if shift is held
            if (e.shiftKey) {
              const aspectRatio = startWidth / startHeight;
              if (handle.includes('right') || handle.includes('left') || handle.includes('e') || handle.includes('w')) {
                newHeight = newWidth / aspectRatio;
              } else {
                newWidth = newHeight * aspectRatio;
              }
            }

            // Minimum size
            newWidth = Math.max(50, newWidth);
            newHeight = Math.max(50, newHeight);

            (img as HTMLElement).style.width = `${newWidth}px`;
            (img as HTMLElement).style.height = `${newHeight}px`;
          };

          const handleMouseUp = () => {
            isResizing = false;
            img.classList.remove('resizing');

            // Update the editor content
            const newWidth = (img as HTMLElement).style.width;
            const newHeight = (img as HTMLElement).style.height;

            if (editor && newWidth && newHeight) {
              // Update the image attributes in the editor
              const imgElement = img as HTMLElement;
              imgElement.setAttribute('width', newWidth);
              imgElement.setAttribute('height', newHeight);

              // Trigger editor update
              editor.commands.focus();
            }

            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
          };

          document.addEventListener('mousemove', handleMouseMove);
          document.addEventListener('mouseup', handleMouseUp);
        };

        // Add event listeners to handles
        const handleElements = img.parentElement?.querySelectorAll('.image-resize-handle');
        handleElements?.forEach((handle, index) => {
          handle.addEventListener('mousedown', (e) => handleMouseDown(e as MouseEvent, handles[index]));
        });
      });
    };

    // Initialize resize functionality after editor is ready and content changes
    const initializeResize = () => {
      setTimeout(handleImageResize, 500);
    };

    // Run on mount and when content changes
    initializeResize();

    // Listen for editor updates
    const handleUpdate = () => {
      initializeResize();
    };

    editor.on('update', handleUpdate);

    return () => {
      editor.off('update', handleUpdate);
    };
  }, [editor]);

  if (!isMounted) {
    return (
      <div className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden h-full flex flex-col">
        <div className="p-4 flex-1 min-h-0 overflow-y-auto">
          <div className="min-h-[200px] flex items-center justify-center text-gray-500 dark:text-gray-400">
            Loading editor...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden h-full flex flex-col">
      <MenuBar editor={editor} fileInputRef={fileInputRef} onChange={onChange} uploadedImages={uploadedImages} />
      <div
        className="p-4 flex-1 min-h-0 overflow-y-auto"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <EditorContent
          editor={editor}
          className="min-h-[200px] focus:outline-none"
        />
        {!content && placeholder && (
          <div className="text-gray-400 dark:text-gray-500 text-sm mt-2">
            {placeholder}
          </div>
        )}

        {/* Hidden file input for image upload */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              handleFileUpload(file);
            }
          }}
        />

        {/* Debug button for testing image resize */}
        <button
          type="button"
          onClick={() => {
            const images = document.querySelectorAll('.ProseMirror img');
            logger.info('Total images in editor:', { data: images.length });
            const resizeHandles = document.querySelectorAll('.image-resize-handle');
            logger.info('Resize handles:', { data: resizeHandles.length });

            // Manually trigger resize initialization
            const handleImageResize = () => {
              const images = document.querySelectorAll('.ProseMirror img:not([data-resize-initialized])');
              logger.info('Found images to resize:', { data: images.length });

              images.forEach((img) => {
                img.setAttribute('data-resize-initialized', 'true');
                logger.info('Processing image:', { data: (img as HTMLImageElement).src });

                // Make sure the image has a parent container
                if (!img.parentElement) {
                  logger.info('No parent element found for image');
                  return;
                }

                // Create resize handles directly in the parent
                const handles = ['nw', 'ne', 'sw', 'se', 'n', 's', 'w', 'e'];
                handles.forEach(handle => {
                  const handleEl = document.createElement('div');
                  handleEl.className = `image-resize-handle ${handle}`;
                  handleEl.style.display = 'block';
                  handleEl.style.position = 'absolute';
                  handleEl.style.zIndex = '1000';
                  handleEl.style.backgroundColor = '#3b82f6';
                  handleEl.style.border = '1px solid white';
                  handleEl.style.borderRadius = '50%';
                  handleEl.style.width = '8px';
                  handleEl.style.height = '8px';
                  handleEl.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.3)';

                  // Position the handle
                  switch (handle) {
                    case 'nw':
                      handleEl.style.top = '-4px';
                      handleEl.style.left = '-4px';
                      handleEl.style.cursor = 'nw-resize';
                      break;
                    case 'ne':
                      handleEl.style.top = '-4px';
                      handleEl.style.right = '-4px';
                      handleEl.style.cursor = 'ne-resize';
                      break;
                    case 'sw':
                      handleEl.style.bottom = '-4px';
                      handleEl.style.left = '-4px';
                      handleEl.style.cursor = 'sw-resize';
                      break;
                    case 'se':
                      handleEl.style.bottom = '-4px';
                      handleEl.style.right = '-4px';
                      handleEl.style.cursor = 'se-resize';
                      break;
                    case 'n':
                      handleEl.style.top = '-4px';
                      handleEl.style.left = '50%';
                      handleEl.style.transform = 'translateX(-50%)';
                      handleEl.style.cursor = 'n-resize';
                      break;
                    case 's':
                      handleEl.style.bottom = '-4px';
                      handleEl.style.left = '50%';
                      handleEl.style.transform = 'translateX(-50%)';
                      handleEl.style.cursor = 's-resize';
                      break;
                    case 'w':
                      handleEl.style.left = '-4px';
                      handleEl.style.top = '50%';
                      handleEl.style.transform = 'translateY(-50%)';
                      handleEl.style.cursor = 'w-resize';
                      break;
                    case 'e':
                      handleEl.style.right = '-4px';
                      handleEl.style.top = '50%';
                      handleEl.style.transform = 'translateY(-50%)';
                      handleEl.style.cursor = 'e-resize';
                      break;
                  }

                  img.parentElement!.appendChild(handleEl);
                  logger.info('Created handle:', { data: handle });
                });

                logger.info('All handles created for image');
              });
            };

            handleImageResize();
          }}
          className="absolute top-2 right-2 bg-blue-500 text-white px-2 py-1 text-xs rounded"
        >
          Debug
        </button>
      </div>
    </div>
  );
} 