import logger from './logger.mjs';

class ImageProcessingQueue {
  constructor(concurrency = 2) {
    this.queue = [];
    this.processing = new Set();
    this.concurrency = concurrency;
  }

  async add(task) {
    return new Promise((resolve, reject) => {
      this.queue.push({
        task,
        resolve,
        reject
      });
      this.processNext();
    });
  }

  async processNext() {
    if (this.processing.size >= this.concurrency || this.queue.length === 0) {
      return;
    }

    const { task, resolve, reject } = this.queue.shift();
    const id = Math.random().toString(36).substring(7);
    this.processing.add(id);

    try {
      const result = await task();
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      this.processing.delete(id);
      setTimeout(() => this.processNext(), 1000); // Задержка 1 секунда между обработкой
    }
  }

  get pending() {
    return this.queue.length;
  }

  get active() {
    return this.processing.size;
  }
}

const imageQueue = new ImageProcessingQueue(2); // Максимум 2 параллельных обработки

export default imageQueue;
