from fastapi import FastAPI
from pydantic import BaseModel
from transformers import CLIPProcessor, CLIPModel
from PIL import Image
import io
import base64

# Cargar el modelo CLIP y el procesador
model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")

# Inicializar la aplicación FastAPI
app = FastAPI()


# Normalizar embeddings
def normalize(embedding):
    return embedding / embedding.norm(dim=-1, keepdim=True)


class TextInput(BaseModel):
    text: str


class ImageBase64Input(BaseModel):
    image_base64: str


# Endpoint para obtener el embedding de un texto
@app.post("/embed/text")
async def get_text_embedding(data: TextInput):
    inputs = processor(text=[data.text], return_tensors="pt", padding=True)
    text_embedding = model.get_text_features(**inputs)
    normalized_embedding = normalize(text_embedding).squeeze().tolist()
    return {"embedding": normalized_embedding}


# Endpoint para obtener el embedding de una imagen en Base64
@app.post("/embed/image")
async def get_image_embedding(data: ImageBase64Input):
    # Decodificar el Base64
    image_data = base64.b64decode(data.image_base64)
    image = Image.open(io.BytesIO(image_data))

    # Procesar la imagen
    inputs = processor(images=image, return_tensors="pt")
    image_embedding = model.get_image_features(**inputs)

    # Normalizar el embedding
    normalized_embedding = normalize(image_embedding).squeeze().tolist()
    return {"embedding": normalized_embedding}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8000)
