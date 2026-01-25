import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, 
  List, ListOrdered, AlignLeft, AlignCenter, AlignRight, 
  Undo, Redo, FileText, Save, Trash2, Plus, Download
} from 'lucide-react';
import { jsPDF } from 'jspdf';

interface Document {
  id: string;
  title: string;
  content: string;
  updatedAt: string;
}

interface StudentWordProcessorProps {
  studentId: number;
}

export function StudentWordProcessor({ studentId }: StudentWordProcessorProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [currentDoc, setCurrentDoc] = useState<Document | null>(null);
  const [title, setTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  const storageKey = `student_docs_${studentId}`;

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Placeholder.configure({
        placeholder: 'Start writing your story, outline, or notes here...',
      }),
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-xl focus:outline-none min-h-[400px] max-w-none p-4',
      },
    },
  });

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        setDocuments(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load documents');
      }
    }
  }, [storageKey]);

  useEffect(() => {
    if (currentDoc && editor) {
      editor.commands.setContent(currentDoc.content);
      setTitle(currentDoc.title);
    }
  }, [currentDoc, editor]);

  const saveDocument = () => {
    if (!editor || !title.trim()) return;
    
    setIsSaving(true);
    const content = editor.getHTML();
    const now = new Date().toISOString();

    let updatedDocs: Document[];
    
    if (currentDoc) {
      updatedDocs = documents.map(doc => 
        doc.id === currentDoc.id 
          ? { ...doc, title, content, updatedAt: now }
          : doc
      );
      setCurrentDoc({ ...currentDoc, title, content, updatedAt: now });
    } else {
      const newDoc: Document = {
        id: Date.now().toString(),
        title,
        content,
        updatedAt: now,
      };
      updatedDocs = [newDoc, ...documents];
      setCurrentDoc(newDoc);
    }

    setDocuments(updatedDocs);
    localStorage.setItem(storageKey, JSON.stringify(updatedDocs));
    setLastSaved(now);
    setIsSaving(false);
  };

  const newDocument = () => {
    setCurrentDoc(null);
    setTitle('');
    editor?.commands.setContent('');
    setLastSaved(null);
  };

  const deleteDocument = (id: string) => {
    const updatedDocs = documents.filter(doc => doc.id !== id);
    setDocuments(updatedDocs);
    localStorage.setItem(storageKey, JSON.stringify(updatedDocs));
    if (currentDoc?.id === id) {
      newDocument();
    }
  };

  const openDocument = (doc: Document) => {
    setCurrentDoc(doc);
  };

  const downloadAsPdf = () => {
    if (!editor) return;
    
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const maxWidth = pageWidth - 2 * margin;
    let yPosition = margin;
    
    // Add title
    if (title) {
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text(title, margin, yPosition);
      yPosition += 12;
    }
    
    // Add line under title
    doc.setDrawColor(200);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 10;
    
    // Get text content and convert to plain text
    const textContent = editor.getText();
    
    // Set font for body text
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    
    // Split text into lines that fit the page width
    const lines = doc.splitTextToSize(textContent, maxWidth);
    
    for (const line of lines) {
      if (yPosition > pageHeight - margin) {
        doc.addPage();
        yPosition = margin;
      }
      doc.text(line, margin, yPosition);
      yPosition += 7;
    }
    
    // Save the PDF
    doc.save(`${title || 'document'}.pdf`);
  };

  if (!editor) return null;

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-full">
      <Card className="lg:w-64 shrink-0">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5" />
              My Documents
            </CardTitle>
            <Button size="icon" variant="ghost" onClick={newDocument} data-testid="button-new-document">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 max-h-[300px] overflow-y-auto">
          {documents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No documents yet. Start writing!</p>
          ) : (
            documents.map(doc => (
              <div
                key={doc.id}
                className={`p-2 rounded cursor-pointer flex items-center justify-between group hover-elevate ${
                  currentDoc?.id === doc.id ? 'bg-primary/10 ring-1 ring-primary/20' : ''
                }`}
                onClick={() => openDocument(doc)}
                data-testid={`document-item-${doc.id}`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{doc.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(doc.updatedAt).toLocaleDateString()}
                  </p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteDocument(doc.id);
                  }}
                  data-testid={`button-delete-document-${doc.id}`}
                >
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="flex-1 flex flex-col">
        <CardHeader className="pb-2 space-y-3">
          <div className="flex items-center gap-2">
            <Input
              placeholder="Document title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-lg font-medium"
              data-testid="input-document-title"
            />
            <Button onClick={saveDocument} disabled={isSaving || !title.trim()} data-testid="button-save-document">
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
            <Button 
              variant="outline" 
              onClick={downloadAsPdf} 
              disabled={!editor?.getText()?.trim()}
              data-testid="button-download-pdf"
            >
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
          </div>
          
          <div className="flex flex-wrap gap-1 border-b pb-2">
            <Button
              size="icon"
              variant={editor.isActive('bold') ? 'secondary' : 'ghost'}
              onClick={() => editor.chain().focus().toggleBold().run()}
              data-testid="button-bold"
            >
              <Bold className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant={editor.isActive('italic') ? 'secondary' : 'ghost'}
              onClick={() => editor.chain().focus().toggleItalic().run()}
              data-testid="button-italic"
            >
              <Italic className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant={editor.isActive('underline') ? 'secondary' : 'ghost'}
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              data-testid="button-underline"
            >
              <UnderlineIcon className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant={editor.isActive('strike') ? 'secondary' : 'ghost'}
              onClick={() => editor.chain().focus().toggleStrike().run()}
              data-testid="button-strikethrough"
            >
              <Strikethrough className="h-4 w-4" />
            </Button>
            
            <div className="w-px h-6 bg-border mx-1 self-center" />
            
            <Button
              size="icon"
              variant={editor.isActive('bulletList') ? 'secondary' : 'ghost'}
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              data-testid="button-bullet-list"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant={editor.isActive('orderedList') ? 'secondary' : 'ghost'}
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              data-testid="button-ordered-list"
            >
              <ListOrdered className="h-4 w-4" />
            </Button>
            
            <div className="w-px h-6 bg-border mx-1 self-center" />
            
            <Button
              size="icon"
              variant={editor.isActive({ textAlign: 'left' }) ? 'secondary' : 'ghost'}
              onClick={() => editor.chain().focus().setTextAlign('left').run()}
              data-testid="button-align-left"
            >
              <AlignLeft className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant={editor.isActive({ textAlign: 'center' }) ? 'secondary' : 'ghost'}
              onClick={() => editor.chain().focus().setTextAlign('center').run()}
              data-testid="button-align-center"
            >
              <AlignCenter className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant={editor.isActive({ textAlign: 'right' }) ? 'secondary' : 'ghost'}
              onClick={() => editor.chain().focus().setTextAlign('right').run()}
              data-testid="button-align-right"
            >
              <AlignRight className="h-4 w-4" />
            </Button>
            
            <div className="w-px h-6 bg-border mx-1 self-center" />
            
            <Button
              size="icon"
              variant="ghost"
              onClick={() => editor.chain().focus().undo().run()}
              disabled={!editor.can().undo()}
              data-testid="button-undo"
            >
              <Undo className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => editor.chain().focus().redo().run()}
              disabled={!editor.can().redo()}
              data-testid="button-redo"
            >
              <Redo className="h-4 w-4" />
            </Button>
          </div>
          
          {lastSaved && (
            <p className="text-xs text-muted-foreground">
              Last saved: {new Date(lastSaved).toLocaleTimeString()}
            </p>
          )}
        </CardHeader>
        
        <CardContent className="flex-1 overflow-auto">
          <div className="border rounded-md bg-background min-h-[400px]">
            <EditorContent editor={editor} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
