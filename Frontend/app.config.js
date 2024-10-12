import "dotenv/config";

export default ({ config }) => ({
    ...config,
    extra: {
        backUrl: process.env.BACK_URL,
    },
    android: {
        package: "com.eurekapp.frontend",
        versionCode: 1
    }
});