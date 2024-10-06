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
- PINECONE_SECRET_KEY: Secret key from Pinecone


# Frontend
There was a problem with google maps keys in react native running on android, the solution is in this [issue](https://github.com/react-native-maps/react-native-maps/issues/4393)
