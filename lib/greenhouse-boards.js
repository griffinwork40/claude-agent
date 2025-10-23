"use strict";
// lib/greenhouse-boards.ts
// Greenhouse board token registry and management
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_BOARD_TOKENS = void 0;
exports.extractBoardTokenFromUrl = extractBoardTokenFromUrl;
exports.isValidBoardToken = isValidBoardToken;
exports.getBoardTokens = getBoardTokens;
exports.discoverBoardToken = discoverBoardToken;
exports.DEFAULT_BOARD_TOKENS = [
    'airbnb',
    'stripe',
    'shopify',
    'github',
    'gitlab',
    'atlassian',
    'dropbox',
    'uber',
    'lyft',
    'doordash',
    'instacart',
    'pinterest',
    'twitter',
    'square',
    'coinbase',
    'robinhood',
    'figma',
    'notion',
    'linear',
    'vercel',
    'netlify',
    'supabase',
    'planetscale',
    'railway',
    'render',
    'anthropic',
    'openai',
    'huggingface',
    'replicate',
    'together',
    'mistral',
    'cohere',
    'perplexity',
    'character',
    'runway',
    'midjourney',
    'stability',
    'scale',
    'labelbox',
    'wandb',
    'weights',
    'comet',
    'neptune',
    'mlflow',
    'dvc',
    'polyaxon',
    'kubeflow',
    'ray',
    'modal',
    'baseten',
    'banana',
    'beam',
    'fal',
    'fireworks',
    'groq',
    'lamini',
    'predibase',
    'predictionguard',
    'portkey',
    'langchain',
    'langfuse',
    'langsmith',
    'llamaindex',
    'haystack',
    'chroma',
    'pinecone',
    'weaviate',
    'qdrant',
    'milvus',
    'faiss',
    'elasticsearch',
    'opensearch',
    'redis',
    'cassandra',
    'mongodb',
    'postgresql',
    'mysql',
    'sqlite',
    'clickhouse',
    'bigquery',
    'snowflake',
    'databricks',
    'redshift',
    's3',
    'gcs',
    'azure',
    'cloudflare',
    'aws',
    'gcp',
    'digitalocean',
    'linode',
    'vultr',
    'hetzner',
    'ovh',
    'scaleway',
    'exoscale',
    'kamatera'
];
function extractBoardTokenFromUrl(url) {
    try {
        const urlObj = new URL(url);
        if (urlObj.hostname === 'boards.greenhouse.io') {
            const pathParts = urlObj.pathname.split('/').filter(Boolean);
            if (pathParts.length > 0) {
                return pathParts[0];
            }
        }
        return null;
    }
    catch {
        return null;
    }
}
function isValidBoardToken(boardToken) {
    return exports.DEFAULT_BOARD_TOKENS.includes(boardToken.toLowerCase());
}
function getBoardTokens() {
    const envBoards = process.env.GREENHOUSE_DEFAULT_BOARDS;
    if (envBoards) {
        return envBoards.split(',').map(token => token.trim()).filter(Boolean);
    }
    return exports.DEFAULT_BOARD_TOKENS;
}
function discoverBoardToken(companyName) {
    const variations = [
        companyName.toLowerCase(),
        companyName.toLowerCase().replace(/\s+/g, ''),
        companyName.toLowerCase().replace(/\s+/g, '-'),
        companyName.toLowerCase().replace(/[^a-z0-9]/g, ''),
    ];
    for (const variation of variations) {
        if (exports.DEFAULT_BOARD_TOKENS.includes(variation)) {
            return variation;
        }
    }
    return null;
}
