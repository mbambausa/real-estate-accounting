// src/lib/passwordUtils.js
export async function hashPassword(password) {
  // Generate a random salt
  const salt = crypto.getRandomValues(new Uint8Array(16));
  
  // Encode password
  const encoder = new TextEncoder();
  const passwordData = encoder.encode(password);
  
  // Combine salt and password
  const combined = new Uint8Array(salt.length + passwordData.length);
  combined.set(salt);
  combined.set(passwordData, salt.length);
  
  // Hash with SHA-256
  const hash = await crypto.subtle.digest('SHA-256', combined);
  
  // Convert salt and hash to base64
  const saltBase64 = btoa(String.fromCharCode(...salt));
  const hashBase64 = btoa(String.fromCharCode(...new Uint8Array(hash)));
  
  // Return salt and hash separated by a dot
  return `${saltBase64}.${hashBase64}`;
}

export async function verifyPassword(storedHash, password) {
  // Split stored hash into salt and hash
  const [saltBase64, hashBase64] = storedHash.split('.');
  
  // Decode salt
  const salt = Uint8Array.from(atob(saltBase64), c => c.charCodeAt(0));
  
  // Encode password
  const encoder = new TextEncoder();
  const passwordData = encoder.encode(password);
  
  // Combine salt and password
  const combined = new Uint8Array(salt.length + passwordData.length);
  combined.set(salt);
  combined.set(passwordData, salt.length);
  
  // Hash with SHA-256
  const hash = await crypto.subtle.digest('SHA-256', combined);
  const newHashBase64 = btoa(String.fromCharCode(...new Uint8Array(hash)));
  
  // Compare hashes
  return hashBase64 === newHashBase64;
}