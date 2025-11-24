import { pipeline } from "@huggingface/transformers"
import type { RegistryEntryEmbedding } from "../registry/RegistryEntry"

// The model to use for generating embeddings (vectors).
// 'Xenova/all-MiniLM-L6-v2' is a good, small, general-purpose model.
const embedder = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", { dtype: "q4" })

let initPromise: Promise<RegistryEntryEmbedding> | null = null

export async function initEmbeddings() {
    if (initPromise) {
        return initPromise
    }

    initPromise = fetch("https://romanlamsal.github.io/lamsal-kit/embeddings.json")
        .then(res => res.json() as Promise<RegistryEntryEmbedding>)
        .catch(() => [])

    return initPromise
}

export async function searchVectors(queryText: string, topK = 3) {
    const indexedData = await initEmbeddings()

    // Step 1: Generate the vector for the query text
    const queryOutput = await embedder(queryText, { pooling: "mean", normalize: true })
    const queryVector = queryOutput.data

    // Step 2: Calculate the similarity (using the Dot Product for normalized vectors)
    const results = indexedData.map(item => {
        // A simple similarity measure: Dot Product (since vectors are normalized)
        // For normalized vectors, Dot Product == Cosine Similarity
        let similarity = 0
        for (let i = 0; i < Math.min(queryVector.length, item.vector.length); i++) {
            similarity += queryVector[i] * item.vector[i]!
        }

        return { ...item, similarity }
    })

    // Step 3: Sort and return the top results
    results.sort((a, b) => b.similarity - a.similarity)

    return results.slice(0, topK)
}
