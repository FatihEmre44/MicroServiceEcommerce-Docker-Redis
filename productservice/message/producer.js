const amqp = require('amqplib');

let channel;

// RabbitMQ bağlantısı
async function connectRabbit(retries = 5, delay = 3000) {
	for (let i = 0; i < retries; i++) {
		try {
			const connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost');
			channel = await connection.createChannel();
			console.log('RabbitMQ bağlantısı başarılı (productservice)');
			return;
		} catch (err) {
			console.log(`RabbitMQ bağlantı denemesi ${i + 1}/${retries} başarısız. ${delay/1000}s sonra tekrar...`);
			if (i < retries - 1) {
				await new Promise(resolve => setTimeout(resolve, delay));
			}
		}
	}
	console.error('RabbitMQ bağlantısı kurulamadı!');
}

// Mesaj gönderme fonksiyonu
const publishEvent = (queueName, data) => {
	if (!channel) return console.error('RabbitMQ hazır değil!');
	channel.sendToQueue(queueName, Buffer.from(JSON.stringify(data)));
};

// Mesaj alma (bildirim dinleme) fonksiyonu
const consumeEvent = async (queueName, callback) => {
	if (!channel) return console.error('RabbitMQ hazır değil!');
	await channel.assertQueue(queueName, { durable: true });
	channel.consume(queueName, msg => {
		if (msg) {
			const content = JSON.parse(msg.content.toString());
			callback(content);
			channel.ack(msg);
		}
	});
};

module.exports = { connectRabbit, publishEvent, consumeEvent };
