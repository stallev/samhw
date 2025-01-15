export function logMemoryUsage(label) {
  const used = process.memoryUsage();
  console.log(`\n=== Memory Usage at ${label} ===`);
  console.log(`Heap Used: ${Math.round(used.heapUsed / 1024 / 1024 * 100) / 100} MB`);
  console.log(`Heap Total: ${Math.round(used.heapTotal / 1024 / 1024 * 100) / 100} MB`);
  console.log(`RSS: ${Math.round(used.rss / 1024 / 1024 * 100) / 100} MB`);
  console.log(`External: ${Math.round(used.external / 1024 / 1024 * 100) / 100} MB\n`);
}

// Функция для отслеживания пиковой памяти
let peakMemory = 0;
export function trackPeakMemory(label) {
  const used = process.memoryUsage().heapUsed;
  if (used > peakMemory) {
    peakMemory = used;
    console.log(`New peak memory at ${label}: ${Math.round(peakMemory / 1024 / 1024 * 100) / 100} MB`);
  }
}

// Функция для очистки памяти
export function attemptGarbageCollection() {
  if (global.gc) {
    global.gc();
  }
}