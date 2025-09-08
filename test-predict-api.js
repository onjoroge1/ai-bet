// Test script to call /predict API directly for match ID 1391284
const fetch = require('node-fetch');

async function testPredictAPI() {
  console.log('🎯 TESTING /predict API FOR MATCH 1391284\n');
  
  const matchId = 1391284;
  
  try {
    console.log(`Calling /predict API for match ID: ${matchId}`);
    console.log('Request details:');
    console.log(`  URL: http://localhost:8000/predict`);
    console.log(`  Method: POST`);
    console.log(`  Body: {"match_id": ${matchId}}`);
    console.log('');
    
    const response = await fetch('http://localhost:8000/predict', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer betgenius_secure_key_2024'
      },
      body: JSON.stringify({
        match_id: matchId
      })
    });
    
    console.log(`Response Status: ${response.status} ${response.statusText}`);
    console.log(`Response Headers:`, Object.fromEntries(response.headers.entries()));
    console.log('');
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log(`❌ Error Response: ${errorText}`);
      return;
    }
    
    const predictionData = await response.json();
    
    console.log('✅ SUCCESS! Prediction data received:');
    console.log('=====================================');
    console.log(`Response size: ${JSON.stringify(predictionData).length} characters`);
    console.log('');
    
    // Show the structure
    console.log('📊 PREDICTION DATA STRUCTURE:');
    console.log('=============================');
    console.log(`Top-level keys: ${Object.keys(predictionData).join(', ')}`);
    console.log('');
    
    // Show each section
    Object.keys(predictionData).forEach(key => {
      const value = predictionData[key];
      console.log(`🔹 ${key}:`);
      if (typeof value === 'object' && value !== null) {
        if (Array.isArray(value)) {
          console.log(`   Type: Array (${value.length} items)`);
          if (value.length > 0) {
            console.log(`   First item keys: ${Object.keys(value[0]).join(', ')}`);
          }
        } else {
          console.log(`   Type: Object`);
          console.log(`   Keys: ${Object.keys(value).join(', ')}`);
          
          // Show some sample values for key fields
          if (key === 'predictions' && value.confidence) {
            console.log(`   Confidence: ${value.confidence}`);
            console.log(`   Recommended bet: ${value.recommended_bet}`);
          }
          if (key === 'match_info' && value.match_id) {
            console.log(`   Match ID: ${value.match_id}`);
            console.log(`   Teams: ${value.home_team} vs ${value.away_team}`);
          }
        }
      } else {
        console.log(`   Value: ${value}`);
      }
      console.log('');
    });
    
    // Show the full JSON (formatted)
    console.log('📄 FULL PREDICTION DATA (JSON):');
    console.log('================================');
    console.log(JSON.stringify(predictionData, null, 2));
    
    // Test what would be stored in database
    console.log('\n💾 DATABASE STORAGE TEST:');
    console.log('==========================');
    console.log(`Would store as predictionData: ${JSON.stringify(predictionData).length} characters`);
    console.log(`Has analysis section: ${!!predictionData.analysis}`);
    console.log(`Has comprehensive_analysis section: ${!!predictionData.comprehensive_analysis}`);
    console.log(`Has ai_summary: ${!!predictionData.analysis?.ai_summary}`);
    
    if (predictionData.analysis) {
      console.log(`Analysis keys: ${Object.keys(predictionData.analysis).join(', ')}`);
    }
    
    if (predictionData.comprehensive_analysis) {
      console.log(`Comprehensive analysis keys: ${Object.keys(predictionData.comprehensive_analysis).join(', ')}`);
    }
    
  } catch (error) {
    console.error('❌ Error calling /predict API:', error.message);
    if (error.code) {
      console.error(`Error code: ${error.code}`);
    }
  }
}

// Run the test
testPredictAPI().catch(console.error);
