const { CacheManager } = require('../lib/cache-manager.ts');

console.log('🧪 Testing Cache Configuration Fix...\n');

try {
  // Test accessing the static CONFIGS property
  console.log('✅ Testing CacheManager.CONFIGS.CLAIMED_TIPS...');
  const claimedTipsConfig = CacheManager.CONFIGS.CLAIMED_TIPS;
  console.log('   TTL:', claimedTipsConfig.ttl);
  console.log('   Prefix:', claimedTipsConfig.prefix);
  
  console.log('\n✅ Testing CacheManager.CONFIGS.CREDIT_BALANCE...');
  const creditBalanceConfig = CacheManager.CONFIGS.CREDIT_BALANCE;
  console.log('   TTL:', creditBalanceConfig.ttl);
  console.log('   Prefix:', creditBalanceConfig.prefix);
  
  console.log('\n✅ All cache configurations accessible!');
  console.log('\n📋 Available configurations:');
  Object.keys(CacheManager.CONFIGS).forEach(key => {
    const config = CacheManager.CONFIGS[key];
    console.log(`   ${key}: TTL=${config.ttl}s, Prefix=${config.prefix}`);
  });
  
} catch (error) {
  console.error('❌ Error testing cache configuration:', error);
  process.exit(1);
}

console.log('\n🎉 Cache configuration test passed!'); 