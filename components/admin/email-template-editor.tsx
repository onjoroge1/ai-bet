'use client'

import { useState, useCallback, useEffect } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import TextAlign from '@tiptap/extension-text-align'
import Underline from '@tiptap/extension-underline'
import { TextStyle } from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import { 
  Bold, 
  Italic, 
  Underline as UnderlineIcon, 
  Strikethrough, 
  List, 
  ListOrdered, 
  AlignLeft, 
  AlignCenter, 
  AlignRight, 
  AlignJustify,
  Link as LinkIcon,
  Image as ImageIcon,
  Palette,
  Highlighter,
  Code,
  Quote,
  Undo,
  Redo,
  ChevronDown
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu'
import { EmailVariable } from '@/types/email-templates'

interface EmailTemplateEditorProps {
  content: string
  onChange: (content: string) => void
  variables?: EmailVariable[]
  placeholder?: string
}

export function EmailTemplateEditor({ 
  content, 
  onChange, 
  variables = [], 
  placeholder = 'Start writing your email template...' 
}: EmailTemplateEditorProps) {
  const [showVariables, setShowVariables] = useState(false)
  const [isClient, setIsClient] = useState(false)

  // Ensure we're on the client side
  useEffect(() => {
    setIsClient(true)
  }, [])

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-600 underline cursor-pointer',
        },
      }),
      Image.configure({
        HTMLAttributes: {
          class: 'max-w-full h-auto',
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
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    immediatelyRender: false, // Fix SSR hydration issue
  })

  const insertVariable = useCallback((variable: EmailVariable) => {
    if (editor) {
      const variableText = `{{${variable.name}}}`
      editor.chain().focus().insertContent(variableText).run()
    }
  }, [editor])

  const addLink = useCallback(() => {
    const url = window.prompt('Enter URL')
    if (url && editor) {
      editor.chain().focus().setLink({ href: url }).run()
    }
  }, [editor])

  const addImage = useCallback(() => {
    const url = window.prompt('Enter image URL')
    if (url && editor) {
      editor.chain().focus().setImage({ src: url }).run()
    }
  }, [editor])

  // Don't render until we're on the client
  if (!isClient || !editor) {
    return (
      <div className="border rounded-lg bg-white">
        <div className="border-b p-2 flex flex-wrap gap-1 items-center">
          <div className="text-gray-400 text-sm">Loading editor...</div>
        </div>
        <div className="p-4 min-h-[400px] flex items-center justify-center">
          <div className="text-gray-400">Initializing rich text editor...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="border rounded-lg bg-white">
      {/* Toolbar */}
      <div className="border-b p-2 flex flex-wrap gap-1 items-center">
        {/* Text Formatting */}
        <div className="flex items-center gap-1">
          <Button
            variant={editor.isActive('bold') ? 'default' : 'outline'}
            size="sm"
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <Bold className="w-4 h-4" />
          </Button>
          <Button
            variant={editor.isActive('italic') ? 'default' : 'outline'}
            size="sm"
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <Italic className="w-4 h-4" />
          </Button>
          <Button
            variant={editor.isActive('underline') ? 'default' : 'outline'}
            size="sm"
            onClick={() => editor.chain().focus().toggleUnderline().run()}
          >
            <UnderlineIcon className="w-4 h-4" />
          </Button>
          <Button
            variant={editor.isActive('strike') ? 'default' : 'outline'}
            size="sm"
            onClick={() => editor.chain().focus().toggleStrike().run()}
          >
            <Strikethrough className="w-4 h-4" />
          </Button>
        </div>

        <div className="w-px h-6 bg-gray-300 mx-2" />

        {/* Lists */}
        <div className="flex items-center gap-1">
          <Button
            variant={editor.isActive('bulletList') ? 'default' : 'outline'}
            size="sm"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            <List className="w-4 h-4" />
          </Button>
          <Button
            variant={editor.isActive('orderedList') ? 'default' : 'outline'}
            size="sm"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          >
            <ListOrdered className="w-4 h-4" />
          </Button>
        </div>

        <div className="w-px h-6 bg-gray-300 mx-2" />

        {/* Alignment */}
        <div className="flex items-center gap-1">
          <Button
            variant={editor.isActive({ textAlign: 'left' }) ? 'default' : 'outline'}
            size="sm"
            onClick={() => editor.chain().focus().setTextAlign('left').run()}
          >
            <AlignLeft className="w-4 h-4" />
          </Button>
          <Button
            variant={editor.isActive({ textAlign: 'center' }) ? 'default' : 'outline'}
            size="sm"
            onClick={() => editor.chain().focus().setTextAlign('center').run()}
          >
            <AlignCenter className="w-4 h-4" />
          </Button>
          <Button
            variant={editor.isActive({ textAlign: 'right' }) ? 'default' : 'outline'}
            size="sm"
            onClick={() => editor.chain().focus().setTextAlign('right').run()}
          >
            <AlignRight className="w-4 h-4" />
          </Button>
          <Button
            variant={editor.isActive({ textAlign: 'justify' }) ? 'default' : 'outline'}
            size="sm"
            onClick={() => editor.chain().focus().setTextAlign('justify').run()}
          >
            <AlignJustify className="w-4 h-4" />
          </Button>
        </div>

        <div className="w-px h-6 bg-gray-300 mx-2" />

        {/* Links and Images */}
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={addLink}
          >
            <LinkIcon className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={addImage}
          >
            <ImageIcon className="w-4 h-4" />
          </Button>
        </div>

        <div className="w-px h-6 bg-gray-300 mx-2" />

        {/* Colors */}
        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Palette className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {['#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'].map((color) => (
                <DropdownMenuItem
                  key={color}
                  onClick={() => editor.chain().focus().setColor(color).run()}
                  className="flex items-center gap-2"
                >
                  <div 
                    className="w-4 h-4 rounded border" 
                    style={{ backgroundColor: color }}
                  />
                  {color}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="outline"
            size="sm"
            onClick={() => editor.chain().focus().toggleHighlight().run()}
          >
            <Highlighter className="w-4 h-4" />
          </Button>
        </div>

        <div className="w-px h-6 bg-gray-300 mx-2" />

        {/* Undo/Redo */}
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
          >
            <Undo className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
          >
            <Redo className="w-4 h-4" />
          </Button>
        </div>

        <div className="w-px h-6 bg-gray-300 mx-2" />

        {/* Variables */}
        {variables.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                Variables
                <ChevronDown className="w-4 h-4 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64">
              <div className="p-2">
                <p className="text-sm font-medium mb-2">Insert Variables</p>
                <div className="space-y-1">
                  {variables.map((variable) => (
                    <DropdownMenuItem
                      key={variable.name}
                      onClick={() => insertVariable(variable)}
                      className="flex items-center justify-between"
                    >
                      <div>
                        <span className="font-medium">{`{{${variable.name}}}`}</span>
                        <p className="text-xs text-gray-500">{variable.description}</p>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {variable.type}
                      </Badge>
                    </DropdownMenuItem>
                  ))}
                </div>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Editor Content */}
      <div className="p-4 min-h-[400px]">
        <EditorContent 
          editor={editor} 
          className="prose max-w-none text-gray-900 bg-white" 
        />
      </div>

      <style jsx>{`
        .ProseMirror {
          color: #1f2937 !important;
          background: white !important;
          min-height: 300px;
          outline: none;
          padding: 0;
        }
        
        .ProseMirror p {
          margin: 0.5em 0;
          color: #1f2937 !important;
        }
        
        .ProseMirror h1,
        .ProseMirror h2,
        .ProseMirror h3,
        .ProseMirror h4,
        .ProseMirror h5,
        .ProseMirror h6 {
          color: #1f2937 !important;
          margin: 0.5em 0;
        }
        
        .ProseMirror ul,
        .ProseMirror ol {
          color: #1f2937 !important;
          padding-left: 1.5em;
        }
        
        .ProseMirror li {
          color: #1f2937 !important;
        }
        
        .ProseMirror blockquote {
          color: #374151 !important;
          border-left: 3px solid #d1d5db;
          margin: 0.5em 0;
          padding-left: 1em;
        }
        
        .ProseMirror code {
          color: #1f2937 !important;
          background: #f3f4f6;
          padding: 0.2em 0.4em;
          border-radius: 0.25em;
        }
        
        .ProseMirror a {
          color: #2563eb !important;
          text-decoration: underline;
        }
        
        .ProseMirror img {
          max-width: 100%;
          height: auto;
        }
        
        .ProseMirror .is-editor-empty:first-child::before {
          color: #9ca3af;
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
        }
      `}</style>
    </div>
  )
} 