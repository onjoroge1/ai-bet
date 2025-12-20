"use client";

import { useState } from "react";

export default function WhatsAppTestPage() {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"custom" | "picks" | "command">("command");
  const [command, setCommand] = useState("");
  const [matchId, setMatchId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const sendTestMessage = async () => {
    if (!phoneNumber) {
      setError("Please enter a phone number");
      return;
    }

    if (messageType === "custom" && !message) {
      setError("Please enter a message");
      return;
    }

    if (messageType === "command" && !command) {
      setError("Please enter a command (1, 2, 3, menu, or matchId)");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      let response;
      
      if (messageType === "command") {
        // Use test-command endpoint
        const body: any = {
          to: phoneNumber,
          command: command,
        };
        
        if (matchId) {
          body.matchId = matchId;
        }

        response = await fetch("/api/whatsapp/test-command", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });
      } else {
        // Use send-test endpoint
        const body: any = {
          to: phoneNumber,
        };

        if (messageType === "picks") {
          body.type = "picks";
        } else {
          body.message = message;
        }

        response = await fetch("/api/whatsapp/send-test", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });
      }

      const data = await response.json();

      if (response.ok && data.success) {
        setResult(data);
      } else {
        setError(data.error || data.details || "Failed to send message");
        // Still show the message content even if send failed
        if (data.fullMessage) {
          setResult({ ...data, success: false });
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">
            WhatsApp Test Page
          </h1>

          <div className="space-y-6">
            {/* Phone Number Input */}
            <div>
              <label
                htmlFor="phone"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Phone Number (E.164 format or any format)
              </label>
              <input
                type="tel"
                id="phone"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., 16783929144 or +16783929144"
              />
            </div>

            {/* Message Type Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Test Type
              </label>
              <div className="flex flex-col gap-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="command"
                    checked={messageType === "command"}
                    onChange={(e) =>
                      setMessageType(e.target.value as "command")
                    }
                    className="mr-2"
                  />
                  <span>Menu Command (1, 2, 3, menu, or matchId)</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="picks"
                    checked={messageType === "picks"}
                    onChange={(e) => setMessageType(e.target.value as "picks")}
                    className="mr-2"
                  />
                  <span>Today's Picks (from /api/market?status=upcoming)</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="custom"
                    checked={messageType === "custom"}
                    onChange={(e) =>
                      setMessageType(e.target.value as "custom")
                    }
                    className="mr-2"
                  />
                  <span>Custom Message</span>
                </label>
              </div>
            </div>

            {/* Command Input (only shown if command is selected) */}
            {messageType === "command" && (
              <>
                <div>
                  <label
                    htmlFor="command"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Command
                  </label>
                  <input
                    type="text"
                    id="command"
                    value={command}
                    onChange={(e) => setCommand(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter: 1, 2, 3, menu, or matchId (e.g., 123456)"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Commands: <strong>1</strong> = Picks, <strong>2</strong> = Buy (needs matchId), <strong>3</strong> = Help, <strong>menu</strong> = Main menu, or enter a <strong>matchId</strong> directly
                  </p>
                </div>
                {(command === "2" || command.startsWith("2")) && (
                  <div>
                    <label
                      htmlFor="matchId"
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
                      Match ID (required for command "2")
                    </label>
                    <input
                      type="text"
                      id="matchId"
                      value={matchId}
                      onChange={(e) => setMatchId(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., 123456"
                    />
                  </div>
                )}
              </>
            )}

            {/* Custom Message Input (only shown if custom is selected) */}
            {messageType === "custom" && (
              <div>
                <label
                  htmlFor="message"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Message
                </label>
                <textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter your message here..."
                />
              </div>
            )}

            {/* Send Button */}
            <button
              onClick={sendTestMessage}
              disabled={loading}
              className="w-full bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {loading
                ? messageType === "command"
                  ? "Processing command..."
                  : messageType === "picks"
                  ? "Fetching picks and sending..."
                  : "Sending..."
                : messageType === "command"
                ? "Test Command"
                : messageType === "picks"
                ? "Send Today's Picks"
                : "Send Custom Message"}
            </button>

            {/* Error Display */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <h3 className="text-red-800 font-medium mb-1">Error</h3>
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            {/* Success Display */}
            {result && (
              <div className="bg-green-50 border border-green-200 rounded-md p-4">
                <h3 className="text-green-800 font-medium mb-2">
                  ✅ Message Sent Successfully!
                </h3>
                <div className="text-sm text-green-700 space-y-1">
                  <p>
                    <strong>To:</strong> {result.to}
                  </p>
                  <p>
                    <strong>Type:</strong> {result.type || result.commandType || "custom"}
                  </p>
                  {result.command && (
                    <p>
                      <strong>Command:</strong> {result.command}
                    </p>
                  )}
                  <p>
                    <strong>Message Length:</strong> {result.messageLength}{" "}
                    characters
                  </p>
                  {result.fullMessage && (
                    <div className="mt-3">
                      <p className="font-medium mb-1">Full Message Content:</p>
                      <pre className="bg-white p-4 rounded border border-green-200 text-xs whitespace-pre-wrap overflow-auto max-h-96 border-2">
                        {result.fullMessage}
                      </pre>
                    </div>
                  )}
                  {!result.fullMessage && result.preview && (
                    <div className="mt-3">
                      <p className="font-medium mb-1">Preview:</p>
                      <pre className="bg-white p-3 rounded border border-green-200 text-xs whitespace-pre-wrap overflow-auto max-h-60">
                        {result.preview}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Instructions */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">
              How to Use
            </h2>
            <ul className="list-disc list-inside space-y-2 text-sm text-gray-600">
              <li>
                <strong>Menu Command:</strong> Test WhatsApp menu commands. Enter <strong>1</strong> for picks, <strong>2</strong> for buy (requires matchId), <strong>3</strong> for help, <strong>menu</strong> for main menu, or enter a <strong>matchId</strong> directly to test purchase flow.
              </li>
              <li>
                <strong>Today's Picks:</strong> Select "Today's Picks" and enter
                your phone number. This will fetch matches from{" "}
                <code className="bg-gray-100 px-1 rounded">
                  /api/market?status=upcoming&limit=50
                </code>{" "}
                and send them formatted exactly as WhatsApp users receive when
                they type "1".
              </li>
              <li>
                <strong>Custom Message:</strong> Select "Custom Message" and
                enter both phone number and message text.
              </li>
              <li>
                <strong>Phone Format:</strong> You can use any format (e.g.,{" "}
                <code className="bg-gray-100 px-1 rounded">16783929144</code>{" "}
                or <code className="bg-gray-100 px-1 rounded">+16783929144</code>
                ). It will be automatically formatted to E.164.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

