import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

export async function GET() {
  try {
    // Check if Redis credentials are available
    if (!process.env.REDIS_URL || !process.env.REDIS_TOKEN) {
      return NextResponse.json({
        error: 'Redis credentials not found',
        hasRedisUrl: !!process.env.REDIS_URL,
        hasRedisToken: !!process.env.REDIS_TOKEN
      }, { status: 400 });
    }

    // Initialize Redis client
    const redis = new Redis({
      url: process.env.REDIS_URL,
      token: process.env.REDIS_TOKEN,
    });

    // Test Redis connection with a simple set/get
    const testKey = 'test:connection';
    const testValue = `Redis test at ${new Date().toISOString()}`;

    // Set a test value
    await redis.set(testKey, testValue);
    
    // Get the test value
    const retrievedValue = await redis.get(testKey);

    // Delete the test value
    await redis.del(testKey);

    return NextResponse.json({
      success: true,
      message: 'Redis connection successful',
      test: {
        set: testValue,
        get: retrievedValue,
        match: testValue === retrievedValue
      }
    });

  } catch (error) {
    console.error('Redis test error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    return NextResponse.json({
      error: 'Redis connection failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 