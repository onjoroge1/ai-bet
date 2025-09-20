#!/usr/bin/env node

/**
 * Test if the sync button exists and is clickable
 * This script will be run in the browser console
 */

console.log('🧪 Testing Sync Button Existence');

// Check if the button exists
const syncButton = document.getElementById('sync-matches-button');
console.log('🔍 Sync button found:', syncButton);

if (syncButton) {
  console.log('✅ Button exists!');
  console.log('🔍 Button disabled:', syncButton.disabled);
  console.log('🔍 Button text:', syncButton.textContent);
  console.log('🔍 Button classes:', syncButton.className);
  
  // Check if click handler is attached
  const clickHandler = syncButton.onclick;
  console.log('🔍 Click handler:', clickHandler);
  
  // Try to click the button programmatically
  console.log('🖱️ Attempting to click button...');
  try {
    syncButton.click();
    console.log('✅ Button click executed');
  } catch (error) {
    console.error('❌ Error clicking button:', error);
  }
} else {
  console.log('❌ Button not found!');
  console.log('🔍 Available buttons:', document.querySelectorAll('button'));
  console.log('🔍 All elements with sync in text:', document.querySelectorAll('*[id*="sync"], *[class*="sync"]'));
}

console.log('🧪 Button test completed');

