from fastapi import APIRouter, HTTPException
from app.models.auth import RegisterRequest, LoginRequest, TokenResponse
from app.services.auth_service import register_user, authenticate_user, create_access_token

router = APIRouter()

@router.post("/register")
def register(request: RegisterRequest):
    success = register_user(request.username, request.password)
    if not success:
        raise HTTPException(status_code=400, detail="Username already exists")
    return {"message": f"User '{request.username}' registered successfully"}

@router.post("/login", response_model=TokenResponse)
def login(request: LoginRequest):
    if not authenticate_user(request.username, request.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token({"sub": request.username})
    return TokenResponse(access_token=token)