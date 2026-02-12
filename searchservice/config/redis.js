const Redis = require('ioredis');

let client;

/**
 * Redis bağlantısı oluşturur
 */
async function connectRedis(retries = 5, delay = 3000) {
    for (let i = 0; i < retries; i++) {
        try {
            client = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
                retryStrategy(times) {
                    const retryDelay = Math.min(times * 500, 3000);
                    return retryDelay;
                },
                maxRetriesPerRequest: 3
            });

            // Bağlantıyı test et
            await client.ping();
            console.log('🔴 Redis bağlantısı başarılı (searchservice)');
            return client;
        } catch (err) {
            console.log(`Redis bağlantı denemesi ${i + 1}/${retries} başarısız. ${delay / 1000}s sonra tekrar...`);
            if (client) {
                client.disconnect();
                client = null;
            }
            if (i < retries - 1) {
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    throw new Error('Redis bağlantısı kurulamadı!');
}

/**
 * Redis client'ı döner
 */
function getRedisClient() {
    if (!client) throw new Error('Redis henüz bağlanmadı!');
    return client;
}

module.exports = { connectRedis, getRedisClient };
