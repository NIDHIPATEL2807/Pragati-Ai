from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Depends
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Optional
from pydantic import BaseModel
import os
from dotenv import load_dotenv

# Import our modules
from db_setup import SessionLocal, Document, DocumentChunk, Base, engine
from document_processor import process_document
from quiz_generator import QuizQuestion, generate_quiz_for_document
from rag_chatbot import ChatMessage, ChatResponse, chat_with_documents

# Load environment variables
load_dotenv()

# Initialize FastAPI app
app = FastAPI(title="Learning Platform API", description="API for document processing, quiz generation, and RAG chatbot")

# Add CORS middleware
origins = [
    "http://localhost:3000",  # Your React frontend URL
    "http://localhost:5173",  # Alternative frontend URL (if using Vite)
    "http://localhost:8080",  # Another possible frontend URL
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models for request and response validation
class QuizRequest(BaseModel):
    doc_id: int

class QuizResponse(BaseModel):
    quiz: List[QuizQuestion]

class QuizEvaluationRequest(BaseModel):
    quiz: List[QuizQuestion]
    answers: Dict[int, int]

class ChatRequest(BaseModel):
    message: str
    conversation_history: Optional[List[ChatMessage]] = None

# Dependency to get database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Ensure database is set up
@app.on_event("startup")
async def startup_event():
    # Create SQL tables
    Base.metadata.create_all(bind=engine)

    # Delete all documents and related chunks at startup
    db = SessionLocal()
    try:
        db.query(DocumentChunk).delete()
        db.query(Document).delete()
        db.commit()
        print("All documents and chunks deleted at startup.")
    finally:
        db.close()
    
# Document upload endpoint
@app.post("/upload-document")
async def upload_document(
    file: UploadFile = File(...),
    title: str = Form(...)
):
    try:
        # Process in a background task to prevent timeouts
        import asyncio
        from concurrent.futures import ThreadPoolExecutor
        with ThreadPoolExecutor() as executor:
            document_id = await asyncio.get_event_loop().run_in_executor(
                executor,
                process_document,
                file.file,
                file.filename,
                title
            )
        
        return {"message": "Document processed successfully", "document_id": document_id}
    except Exception as e:
        print(f"Error in upload_document: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error processing document: {str(e)}")

# Get all documents endpoint
@app.get("/documents")
async def get_documents(db = Depends(get_db)):
    documents = db.query(Document).all()
    return [{"id": doc.id, "title": doc.title} for doc in documents]

# Generate quiz endpoint
@app.post("/generate-quiz", response_model=QuizResponse)
async def generate_quiz(req: QuizRequest):
    print(f"Received quiz generation request for document ID: {req.doc_id}")
    quiz = generate_quiz_for_document(req.doc_id)
    if not quiz:
        raise HTTPException(status_code=404, detail="Could not generate quiz for this document.")
    return {"quiz": quiz}

# Evaluate quiz endpoint
@app.post("/evaluate-quiz")
async def evaluate_quiz(req: QuizEvaluationRequest):
    topic_stats = {}
    correct = 0
    quiz = req.quiz
    response = req.answers
    
    for idx, q in enumerate(quiz):
        user_ans = response.get(idx)
        if user_ans is not None and user_ans == q.correct_index:
            correct += 1
            topic = q.topic
            topic_stats[topic] = topic_stats.get(topic, 0) + 1
    
    total = len(quiz)
    analysis = {}
    
    for topic in set(q.topic for q in quiz):
        topic_correct = topic_stats.get(topic, 0)
        topic_total = sum(1 for q in quiz if q.topic == topic)
        accuracy = topic_correct / topic_total if topic_total > 0 else 0
        
        if accuracy >= 0.75:
            status = "strong"
        elif accuracy <= 0.5:
            status = "needs practice"
        else:
            status = "satisfactory"
        
        analysis[topic] = status
    
    return {"score": correct, "total": total, "topic_analysis": analysis}

# Chat endpoint
@app.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    try:
        # Since your FastAPI endpoint is async, make this call awaitable
        response = await chat_with_documents(req.message, req.conversation_history)
        return response
    except Exception as e:
        import traceback
        traceback.print_exc()  # Print the full stack trace to your server logs
        raise HTTPException(status_code=500, detail=f"Error processing chat: {str(e)}")
    
@app.get("/")
async def read_root():
    return {"message": "Learning Platform API with FastAPI and Groq"}
