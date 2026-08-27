/**
 * Vercel serverless entry. One function handles every /api/* route by handing
 * the request to the same Express app that runs locally, so there is exactly
 * one implementation of the API rather than a web version and a serverless one
 * that drift apart.
 */
export { default } from '../be/src/app.js'
