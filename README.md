# EurekApp

Proyecto final UTN FRC año 2024

# How to run this project locally
Make sure you have a local MySql DB running, set database related variables to your DB instance
- AWS_ACCESS_KEY_ID: This key is from AWS IAM
- AWS_SECRET_ACCESS_KEY: This secret key is from IAM 
- DATABASE_PASS: Password of local database 
- DATABASE_URL: Database url
- DATABASE_USER: Database user
- JWT_SIGN_KEY: Some random string to sign jwt tokens
- OPENAI_SECRET_KEY: Secret key from OpenAi


# Frontend
There was a problem with google maps keys in react native running on android, the solution is in this [issue](https://github.com/react-native-maps/react-native-maps/issues/4393)

# Weaviate
Weaviate is used as the vector database for this project. To run an instance of it, run the command `docker compose up -d` at the root of this project. In addition, the classes must be created by creating a request using the following curl:
#### Creating FoundObject class
```shell
curl --location 'http://localhost:8081/v1/schema' \
--header 'Content-Type: application/json' \
--data '{
  "class": "FoundObject",
  "description": "Clase para representar objetos encontrados.",
  "vectorIndexType": "hnsw",
    "vectorIndexConfig": {
        "distance": "cosine"
    },
  "properties": [
    {
      "name": "found_date",
      "dataType": ["date"]
    },
    {
      "name": "title",
      "dataType": ["string"]
    },
    {
      "name": "human_description",
      "dataType": ["string"]
    },
    {
      "name": "ai_description",
      "dataType": ["string"]
    },
    {
      "name": "organization_id",
      "dataType": ["text"]
    },
    {
      "name": "coordinates",
      "dataType": ["geoCoordinates"]
    },
    {
      "name": "was_returned",
      "dataType": ["boolean"]
    }
  ]
}'
```

#### Creating LostObject class
````shell
curl --location 'http://localhost:8081/v1/schema' \
--header 'Content-Type: application/json' \
--data '{
  "class": "LostObject",
  "description": "Clase para representar búsquedas abiertas de un objeto perdido.",
  "vectorIndexType": "hnsw",
    "vectorIndexConfig": {
        "distance": "cosine"
    },
  "properties": [
    {
      "name": "lost_date",
      "dataType": ["date"]
    },
    {
      "name": "description",
      "dataType": ["string"]
    },
    {
      "name": "username",
      "dataType": ["string"]
    },
    {
      "name": "organization_id",
      "dataType": ["text"]
    },
    {
      "name": "coordinates",
      "dataType": ["geoCoordinates"]
    }
  ]
}'
````