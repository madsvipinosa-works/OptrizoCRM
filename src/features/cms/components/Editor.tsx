"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";

import { Bold, Italic, List, ListOrdered, Heading1, Heading2, Quote, Link as LinkIcon, Unlink } from "lucide-react";
import { Toggle } from "@/components/ui/toggle";
import { Button } from "@/components/ui/button";
import { useCallback } from "react";

interface EditorProps {
    content: string;
    onChange: (content: string) => void;
}

export function Editor({ content, onChange }: EditorProps) {
    const editor = useEditor({
        immediatelyRender: false,
        extensions: [
            StarterKit,
            Link.configure({
                openOnClick: false,
                HTMLAttributes: {
                    class: 'text-primary underline underline-offset-4 hover:text-primary/80',
                },
            }),
        ],
        content: content,
        editorProps: {
            attributes: {
                class: "prose prose-invert max-w-none min-h-[300px] p-4 bg-white/5 border border-white/10 rounded-md focus:outline-none focus:ring-2 focus:ring-primary",
            },
        },
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML());
        },
    });

    const setLink = useCallback(() => {
        if (!editor) return;
        const previousUrl = editor.getAttributes('link').href;
        const url = window.prompt('URL', previousUrl);

        // cancelled
        if (url === null) return;

        // empty
        if (url === '') {
            editor.chain().focus().extendMarkRange('link').unsetLink().run();
            return;
        }

        // update
        editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }, [editor]);

    if (!editor) {
        return null;
    }

    return (
        <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-1 p-1 bg-white/5 border border-white/10 rounded-md">
                <Toggle
                    size="sm"
                    pressed={editor.isActive("bold")}
                    onPressedChange={() => editor.chain().focus().toggleBold().run()}
                >
                    <Bold className="h-4 w-4" />
                </Toggle>
                <Toggle
                    size="sm"
                    pressed={editor.isActive("italic")}
                    onPressedChange={() => editor.chain().focus().toggleItalic().run()}
                >
                    <Italic className="h-4 w-4" />
                </Toggle>
                <div className="w-px h-6 bg-white/10 mx-1" />
                <Toggle
                    size="sm"
                    pressed={editor.isActive("heading", { level: 2 })}
                    onPressedChange={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                >
                    <Heading1 className="h-4 w-4" />
                </Toggle>
                <Toggle
                    size="sm"
                    pressed={editor.isActive("heading", { level: 3 })}
                    onPressedChange={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                >
                    <Heading2 className="h-4 w-4" />
                </Toggle>
                <div className="w-px h-6 bg-white/10 mx-1" />
                <Toggle
                    size="sm"
                    pressed={editor.isActive("bulletList")}
                    onPressedChange={() => editor.chain().focus().toggleBulletList().run()}
                >
                    <List className="h-4 w-4" />
                </Toggle>
                <Toggle
                    size="sm"
                    pressed={editor.isActive("orderedList")}
                    onPressedChange={() => editor.chain().focus().toggleOrderedList().run()}
                >
                    <ListOrdered className="h-4 w-4" />
                </Toggle>
                <div className="w-px h-6 bg-white/10 mx-1" />
                <Toggle
                    size="sm"
                    pressed={editor.isActive("blockquote")}
                    onPressedChange={() => editor.chain().focus().toggleBlockquote().run()}
                >
                    <Quote className="h-4 w-4" />
                </Toggle>
                <div className="w-px h-6 bg-white/10 mx-1" />
                <Button
                    size="sm"
                    variant={editor.isActive('link') ? "secondary" : "ghost"}
                    className="h-9 w-9 p-0"
                    onClick={setLink}
                >
                    <LinkIcon className="h-4 w-4" />
                </Button>
                {editor.isActive('link') && (
                    <Button
                        size="sm"
                        variant="ghost"
                        className="h-9 w-9 p-0"
                        onClick={() => editor.chain().focus().unsetLink().run()}
                    >
                        <Unlink className="h-4 w-4" />
                    </Button>
                )}
            </div>

            <EditorContent editor={editor} />
        </div>
    );
}
