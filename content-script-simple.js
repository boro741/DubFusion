// Simplified content script for testing
console.log('DubFusion: Simple content script loaded on', window.location.href);

// Create a simple floating button
const testBtn = document.createElement('div');
testBtn.id = 'dubfusion-test';
testBtn.style.cssText = `
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 10000;
  background: #007bff;
  color: white;
  padding: 12px 16px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: bold;
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  font-size: 14px;
`;
testBtn.textContent = 'DubFusion Test';
testBtn.title = 'Test button to verify extension is working';

testBtn.addEventListener('click', () => {
  console.log('DubFusion: Test button clicked!');
  alert('DubFusion extension is working!');
});

document.body.appendChild(testBtn);
console.log('DubFusion: Test button injected');
