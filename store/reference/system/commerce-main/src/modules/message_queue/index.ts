import { Queue, Worker, QueueEvents, FlowProducer, Job, FlowJob } from 'bullmq';
import redisClient from '../cache/redisClient';

type Processor = (job: Job) => Promise<any>;

/**
 * MessageQueueService provides a singleton interface for managing BullMQ queues, workers, and events.
 */
class MessageQueueService {
  private static instance: MessageQueueService;
  private queues = new Map<string, Queue>();
  private events = new Map<string, QueueEvents>();
  private flowProducer = new FlowProducer({ connection: redisClient });

  private constructor() {}

  /**
   * Get the singleton instance of the service.
   */
  public static getInstance(): MessageQueueService {
    if (!MessageQueueService.instance) {
      MessageQueueService.instance = new MessageQueueService();
    }
    return MessageQueueService.instance;
  }

  /**
   * Get or create a queue along with its events listener.
   */
  private getQueueInstance(name: string): Queue {
    if (!this.queues.has(name)) {
      const queue = new Queue(name, { connection: redisClient });
      const events = new QueueEvents(name, { connection: redisClient });

      this.queues.set(name, queue);
      this.events.set(name, events);

      // Listen for failed and completed events
      events.on('failed', ({ jobId, failedReason }: { jobId: string; failedReason: string }) => {
        console.error(`Job ${jobId} in queue ${name} failed:`, failedReason);
      });
      events.on('completed', ({ jobId, returnvalue }: { jobId: string; returnvalue: any }) => {
        console.log(`Job ${jobId} in queue ${name} completed with return value ${returnvalue}`);
      });
    }
    return this.queues.get(name)!;
  }

  /**
   * Add a job to a queue.
   */
  public async addJob<T>(queueName: string, jobName: string, payload: T, opts?: any) {
    const queue = this.getQueueInstance(queueName);
    return queue.add(jobName, payload, opts);
  }

  /**
   * Add a parent-child job flow using FlowProducer.
   */
  public async addFlow(flowJob: FlowJob) {
    return this.flowProducer.add(flowJob);
  }

  /**
   * Process jobs from a queue using the provided processor function.
   */
  public processQueue(queueName: string, processor: Processor, concurrency: number = 5) {
    const worker = new Worker(queueName, processor, {
      connection: redisClient,
      concurrency,
    });
    worker.on('error', (err: Error) => {
      console.error(`Worker error on queue ${queueName}:`, err);
    });
    return worker;
  }

  /**
   * Gracefully close all queues, workers, and flow producer.
   */
  public async close(): Promise<void> {
    await Promise.all([
      ...Array.from(this.queues.values()).map(q => q.close()),
      ...Array.from(this.events.values()).map(e => e.close()),
      this.flowProducer.close(),
    ]);
  }
}

// Export singleton instance
const MessageQueue = MessageQueueService.getInstance();
export default MessageQueue;