from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Note
from ..auth import verify_clerk_token, ClerkUser
from fpdf import FPDF
from docx import Document
from io import BytesIO
import re

router = APIRouter(prefix="/api/notes", tags=["Notes Export"])

def clean_markdown(text):
    # Very basic markdown to plain text conversion
    text = re.sub(r'#+\s*(.*)', r'\1', text) # Headings
    text = re.sub(r'\*\*(.*)\*\*', r'\1', text) # Bold
    text = re.sub(r'\*(.*)\*', r'\1', text) # Italic
    text = re.sub(r'\[(.*)\]\(.*\)', r'\1', text) # Links
    text = re.sub(r'`(.*)`', r'\1', text) # Code
    return text

@router.get("/{note_id}/export/pdf")
async def export_note_pdf(
    note_id: str,
    db: Session = Depends(get_db),
    user: ClerkUser = Depends(verify_clerk_token)
):
    note = db.query(Note).filter(Note.id == note_id, Note.user_id == user.id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Arial", "B", 16)
    pdf.cell(40, 10, note.title)
    pdf.ln(10)
    
    pdf.set_font("Arial", "", 12)
    content = clean_markdown(note.content)
    pdf.multi_cell(0, 10, content)
    
    pdf_bytes = pdf.output(dest='S')
    
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={note.title}.pdf"}
    )

@router.get("/{note_id}/export/docx")
async def export_note_docx(
    note_id: str,
    db: Session = Depends(get_db),
    user: ClerkUser = Depends(verify_clerk_token)
):
    note = db.query(Note).filter(Note.id == note_id, Note.user_id == user.id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    doc = Document()
    doc.add_heading(note.title, 0)
    
    lines = note.content.split('\n')
    for line in lines:
        if line.startswith('# '):
            doc.add_heading(line[2:], level=1)
        elif line.startswith('## '):
            doc.add_heading(line[3:], level=2)
        elif line.startswith('### '):
            doc.add_heading(line[4:], level=3)
        elif line.startswith('- ') or line.startswith('* '):
            doc.add_paragraph(line[2:], style='List Bullet')
        elif line.strip():
            doc.add_paragraph(clean_markdown(line))
            
    f = BytesIO()
    doc.save(f)
    f.seek(0)
    
    return Response(
        content=f.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f"attachment; filename={note.title}.docx"}
    )

@router.get("/{note_id}/export/txt")
async def export_note_txt(
    note_id: str,
    db: Session = Depends(get_db),
    user: ClerkUser = Depends(verify_clerk_token)
):
    note = db.query(Note).filter(Note.id == note_id, Note.user_id == user.id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    content = f"Title: {note.title}\n\n{clean_markdown(note.content)}"
    
    return Response(
        content=content,
        media_type="text/plain",
        headers={"Content-Disposition": f"attachment; filename={note.title}.txt"}
    )
