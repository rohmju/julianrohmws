// Julian's skills dressed up as the hardware in System Properties (right-click My Computer →
// Properties). Keep it in step with the skills in profile.json and the tasks in departments.json.

// General tab: the lines under "Computer:".
export const COMPUTER = ['Julian Rohm', 'Agentic Coding CPU', 'Frontend Graphics, 3+ yrs', '64.0MB RAM']

// Device Manager: one branch per category, the devices under it.
export const DEVICES = [
  { category: 'Processors', icon: 'computer', devices: ['Agentic coding (3+ years)', 'AI agent builder'] },
  { category: 'Display adapters', icon: 'computer', devices: ['Frontend development (3+ years)', 'React, Vite and Three.js'] },
  { category: 'Network adapters', icon: 'network', devices: ['Google Cloud Platform (basics)', 'Terraform (basics)', 'PostgreSQL'] },
  { category: 'System devices', icon: 'settings', devices: ['Java (basics)', 'Python scripting', 'GitHub'] },
  { category: 'Security devices', icon: 'control', devices: ['Cyber security (basics)'] },
  { category: 'Human Interface Devices', icon: 'chat', devices: ['Scrum Master (PSM I)'] },
]
