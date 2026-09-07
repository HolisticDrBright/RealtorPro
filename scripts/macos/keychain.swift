import Foundation
import Security

// Only a random account identifier travels in argv. Passwords use stdin/stdout
// pipes, never shell arguments, environment variables, or temporary text files.
guard CommandLine.arguments.count == 3 else { exit(64) }
let action = CommandLine.arguments[1]
let account = CommandLine.arguments[2]
guard UUID(uuidString: account) != nil else { exit(64) }
let query: [String: Any] = [
    kSecClass as String: kSecClassGenericPassword,
    kSecAttrService as String: "app.realtorpro.claude",
    kSecAttrAccount as String: account
]
func fail(_ status: OSStatus) -> Never {
    // Numeric status only: never log a query, password, or provider response.
    FileHandle.standardError.write(Data("Keychain status \(status)\n".utf8))
    exit(status == errSecItemNotFound ? 44 : 1)
}
switch action {
case "set":
    let secret = FileHandle.standardInput.readData(ofLength: 1001)
    guard !secret.isEmpty, secret.count <= 1000 else { exit(64) }
    var item = query
    item[kSecValueData as String] = secret
    item[kSecAttrLabel as String] = "RealtorPro Claude API key"
    // Use the local macOS login keychain; no synchronization/access-group
    // entitlement is requested. A new UUID means existing items are never replaced.
    let status = SecItemAdd(item as CFDictionary, nil)
    guard status == errSecSuccess else { fail(status) }
case "get":
    var request = query
    request[kSecReturnData as String] = true
    request[kSecMatchLimit as String] = kSecMatchLimitOne
    var result: CFTypeRef?
    let status = SecItemCopyMatching(request as CFDictionary, &result)
    guard status == errSecSuccess else { fail(status) }
    guard let secret = result as? Data else { exit(1) }
    FileHandle.standardOutput.write(secret)
case "delete":
    let status = SecItemDelete(query as CFDictionary)
    guard status == errSecSuccess || status == errSecItemNotFound else { fail(status) }
default:
    exit(64)
}
