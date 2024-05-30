import "dotenv/config";

export default ({ config }) => ({
    ...config,
    extra: {
        backUrl: process.env.BACK_URL,
    },
});