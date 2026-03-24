FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

# JAR pre-construido por CI antes del docker build
COPY target/Backend-0.0.1.jar app.jar

# Usuario no-root
RUN addgroup -S eurekapp && adduser -S eurekapp -G eurekapp
USER eurekapp

EXPOSE 8080

ENTRYPOINT ["java", \
  "-Dspring.profiles.active=${SPRING_PROFILES_ACTIVE:-prod}", \
  "-Xms256m", "-Xmx512m", \
  "-jar", "app.jar"]
