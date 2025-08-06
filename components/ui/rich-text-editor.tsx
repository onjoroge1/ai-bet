'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import TextAlign from '@tiptap/extension-text-align'
import Placeholder from '@tiptap/extension-placeholder'
import { Button } from '@/components/ui/button'
import {
  Bold, Italic, List, ListOrdered, Quote, Heading1, Heading2, Heading3,
  AlignLeft, AlignCenter, AlignRight, Link as LinkIcon, Image as ImageIcon, Undo, Redo
} from 'lucide-react'
import { useState, useEffect } from 'react'

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export function RichTextEditor({ value, onChange, placeholder, className }: RichTextEditorProps) {
  const [showLinkInput, setShowLinkInput] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => setIsMounted(true), [])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'text-emerald-400 hover:text-emerald-300 underline' },
      }),
      Image.configure({
        HTMLAttributes: { class: 'max-w-full h-auto rounded-lg' },
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Placeholder.configure({
        placeholder: ({ node }) =>
          node.type.name === 'heading' ? 'Write a heading…' : (placeholder || 'Start typing…'),
      }),
    ],
    content: value, // initial set
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      onChange(html)
    },
    editorProps: {
      attributes: {
        // Apply prose ONCE here for clean spacing - news article style
        // This creates professional news article spacing:
        // - Paragraphs: 0.75rem top/bottom (12px)
        // - Headings: 1.5rem top, 0.75rem bottom (24px/12px)
        // - Lists: 0.5rem margins, 0.25rem between items
        // - Line height: 1.6 for readability
        class: 'ProseMirror prose prose-invert max-w-none leading-relaxed focus:outline-none min-h-[300px] p-4',
        spellCheck: 'true',
      },
    },
    immediatelyRender: false,
  })

  // Keep editor in sync when parent value changes (avoids messy breaks/spacing)
  useEffect(() => {
    if (!editor) return
    const current = editor.getHTML()
    if (value && value !== current) {
      editor.commands.setContent(value, { emitUpdate: false }) // don't emit onUpdate
    }
  }, [value, editor])

  if (!isMounted || !editor) {
    return (
      <div className={`border border-slate-600 rounded-lg bg-slate-700 ${className}`}>
        <div className="border-b border-slate-600 p-2 flex flex-wrap gap-1">
          <div className="flex gap-1">
            <div className="w-8 h-8 bg-slate-600 rounded" />
            <div className="w-8 h-8 bg-slate-600 rounded" />
            <div className="w-8 h-8 bg-slate-600 rounded" />
          </div>
        </div>
        <div className="min-h-[300px] p-4 text-slate-400">{placeholder || 'Loading editor...'}</div>
      </div>
    )
  }

  const addLink = () => {
    if (!linkUrl) return
    editor.chain().focus().extendMarkRange('link').setLink({ href: linkUrl }).run()
    setLinkUrl('')
    setShowLinkInput(false)
  }

  const addImage = () => {
    const url = window.prompt('Enter image URL:')
    if (url) editor.chain().focus().setImage({ src: url }).run()
  }

  return (
    <div className={`relative border border-slate-600 rounded-lg bg-slate-700 ${className}`}>
      {/* Toolbar */}
      <div className="border-b border-slate-600 p-2 flex flex-wrap gap-1">
        {/* Bold/Italic */}
        <Button type="button" variant="ghost" size="sm"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`h-8 w-8 p-0 ${editor.isActive('bold') ? 'bg-slate-600 text-white' : 'text-slate-300 hover:text-white'}`}>
          <Bold className="w-4 h-4" />
        </Button>
        <Button type="button" variant="ghost" size="sm"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`h-8 w-8 p-0 ${editor.isActive('italic') ? 'bg-slate-600 text-white' : 'text-slate-300 hover:text-white'}`}>
          <Italic className="w-4 h-4" />
        </Button>

        {/* Headings */}
        <Button type="button" variant="ghost" size="sm"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`h-8 w-8 p-0 ${editor.isActive('heading', { level: 1 }) ? 'bg-slate-600 text-white' : 'text-slate-300 hover:text-white'}`}>
          <Heading1 className="w-4 h-4" />
        </Button>
        <Button type="button" variant="ghost" size="sm"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`h-8 w-8 p-0 ${editor.isActive('heading', { level: 2 }) ? 'bg-slate-600 text-white' : 'text-slate-300 hover:text-white'}`}>
          <Heading2 className="w-4 h-4" />
        </Button>
        <Button type="button" variant="ghost" size="sm"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={`h-8 w-8 p-0 ${editor.isActive('heading', { level: 3 }) ? 'bg-slate-600 text-white' : 'text-slate-300 hover:text-white'}`}>
          <Heading3 className="w-4 h-4" />
        </Button>

        {/* Lists */}
        <Button type="button" variant="ghost" size="sm"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`h-8 w-8 p-0 ${editor.isActive('bulletList') ? 'bg-slate-600 text-white' : 'text-slate-300 hover:text-white'}`}>
          <List className="w-4 h-4" />
        </Button>
        <Button type="button" variant="ghost" size="sm"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`h-8 w-8 p-0 ${editor.isActive('orderedList') ? 'bg-slate-600 text-white' : 'text-slate-300 hover:text-white'}`}>
          <ListOrdered className="w-4 h-4" />
        </Button>

        {/* Quote */}
        <Button type="button" variant="ghost" size="sm"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`h-8 w-8 p-0 ${editor.isActive('blockquote') ? 'bg-slate-600 text-white' : 'text-slate-300 hover:text-white'}`}>
          <Quote className="w-4 h-4" />
        </Button>

        {/* Align */}
        <Button type="button" variant="ghost" size="sm"
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          className={`h-8 w-8 p-0 ${editor.isActive({ textAlign: 'left' }) ? 'bg-slate-600 text-white' : 'text-slate-300 hover:text-white'}`}>
          <AlignLeft className="w-4 h-4" />
        </Button>
        <Button type="button" variant="ghost" size="sm"
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          className={`h-8 w-8 p-0 ${editor.isActive({ textAlign: 'center' }) ? 'bg-slate-600 text-white' : 'text-slate-300 hover:text-white'}`}>
          <AlignCenter className="w-4 h-4" />
        </Button>
        <Button type="button" variant="ghost" size="sm"
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          className={`h-8 w-8 p-0 ${editor.isActive({ textAlign: 'right' }) ? 'bg-slate-600 text-white' : 'text-slate-300 hover:text-white'}`}>
          <AlignRight className="w-4 h-4" />
        </Button>

        {/* Link */}
        <Button type="button" variant="ghost" size="sm"
          onClick={() => setShowLinkInput(!showLinkInput)}
          className={`h-8 w-8 p-0 ${editor.isActive('link') ? 'bg-slate-600 text-white' : 'text-slate-300 hover:text-white'}`}>
          <LinkIcon className="w-4 h-4" />
        </Button>

        {/* Image */}
        <Button type="button" variant="ghost" size="sm"
          onClick={addImage}
          className="h-8 w-8 p-0 text-slate-300 hover:text-white">
          <ImageIcon className="w-4 h-4" />
        </Button>

        {/* Undo/Redo */}
        <Button type="button" variant="ghost" size="sm"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          className="h-8 w-8 p-0 text-slate-300 hover:text-white disabled:opacity-50">
          <Undo className="w-4 h-4" />
        </Button>
        <Button type="button" variant="ghost" size="sm"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          className="h-8 w-8 p-0 text-slate-300 hover:text-white disabled:opacity-50">
          <Redo className="w-4 h-4" />
        </Button>
      </div>

      {/* Link Input */}
      {showLinkInput && (
        <div className="border-b border-slate-600 p-2 flex gap-2">
          <input
            type="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="Enter URL..."
            className="flex-1 px-3 py-1 bg-slate-600 border border-slate-500 rounded text-white text-sm"
            onKeyDown={(e) => e.key === 'Enter' && addLink()}
          />
          <Button type="button" size="sm" onClick={addLink} className="bg-emerald-600 hover:bg-emerald-700">
            Add
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setShowLinkInput(false)} className="border-slate-600 text-slate-300">
            Cancel
          </Button>
        </div>
      )}

      {/* Editor */}
      <EditorContent editor={editor} className="min-h-[300px] max-h-[600px] overflow-y-auto" />
    </div>
  )
} 