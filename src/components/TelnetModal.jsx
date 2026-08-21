"use client";
import { useState, useEffect, useRef } from "react";
import {
  Terminal,
  X,
  RefreshCw,
  Trash2,
  Send,
  CornerDownLeft,
} from "lucide-react";
import { socket } from "@/App";

function parseAnsiToHtml(text) {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\x1b\[0m/g, "</span>")
    .replace(/\x1b\[1m/g, '<span class="font-bold text-white">')
    .replace(/\x1b\[31m/g, '<span class="text-red-400">')
    .replace(/\x1b\[32m/g, '<span class="text-emerald-400">')
    .replace(/\x1b\[33m/g, '<span class="text-amber-400">')
    .replace(/\x1b\[34m/g, '<span class="text-blue-400">')
    .replace(/\x1b\[35m/g, '<span class="text-purple-400">')
    .replace(/\x1b\[36m/g, '<span class="text-cyan-400">')
    .replace(/\x1b\[37m/g, '<span class="text-slate-200">')
    .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, ""); // strip unhandled ANSI control codes
}

function processTerminalStream(existingLines, incomingText) {
  let lines = existingLines.length > 0 ? [...existingLines] : [""];
  let currentLine = lines[lines.length - 1];

  for (let i = 0; i < incomingText.length; i++) {
    const char = incomingText[i];
    if (char === "\r") {
      if (incomingText[i + 1] === "\n") {
        // CRLF: Commit current line, start new line
        lines[lines.length - 1] = currentLine;
        lines.push("");
        currentLine = "";
        i++; // skip '\n'
      } else {
        // CR alone: return cursor to start of line (overwrite current prompt in-place)
        currentLine = "";
      }
    } else if (char === "\n") {
      lines[lines.length - 1] = currentLine;
      lines.push("");
      currentLine = "";
    } else if (char === "\b" || char === "\x7f") {
      // Backspace
      currentLine = currentLine.slice(0, -1);
    } else {
      currentLine += char;
    }
  }

  lines[lines.length - 1] = currentLine;

  // Batasi history maksimal 1200 baris agar tetap ringan
  if (lines.length > 1200) {
    lines = lines.slice(lines.length - 1200);
  }
  return lines;
}

export default function TelnetModal({ device, onClose }) {
  const [lines, setLines] = useState([]);
  const [inputVal, setInputVal] = useState("");
  const [status, setStatus] = useState({
    connected: false,
    connecting: true,
    error: null,
  });
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const terminalEndRef = useRef(null);
  const inputRef = useRef(null);

  const connectTelnet = () => {
    if (!device?.remote_address) return;
    setLines([]);
    setStatus({ connected: false, connecting: true, error: null });
    if (socket) {
      socket.emit("telnet_connect", { ip: device.remote_address, port: 23 });
    }
  };

  useEffect(() => {
    connectTelnet();

    if (!socket) return;

    const handleData = (data) => {
      setLines((prev) => processTerminalStream(prev, data));
    };

    const handleStatus = (st) => {
      setStatus(st);
    };

    socket.on("telnet_data", handleData);
    socket.on("telnet_status", handleStatus);

    return () => {
      socket.off("telnet_data", handleData);
      socket.off("telnet_status", handleStatus);
      socket.emit("telnet_disconnect");
    };
  }, [device?.remote_address]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [lines]);

  // Focus input on mount & click
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [status.connected]);

  const handleSendInput = (e) => {
    e?.preventDefault();
    if (!socket) return;

    const text = inputVal;
    socket.emit("telnet_input", text + "\r\n");

    if (text.trim()) {
      setHistory((prev) => [...prev, text]);
      setHistoryIndex(-1);
    }
    setInputVal("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (history.length > 0) {
        const nextIdx =
          historyIndex === -1
            ? history.length - 1
            : Math.max(0, historyIndex - 1);
        setHistoryIndex(nextIdx);
        setInputVal(history[nextIdx] || "");
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex !== -1) {
        const nextIdx = historyIndex + 1;
        if (nextIdx >= history.length) {
          setHistoryIndex(-1);
          setInputVal("");
        } else {
          setHistoryIndex(nextIdx);
          setInputVal(history[nextIdx] || "");
        }
      }
    } else if (e.key === "Tab") {
      e.preventDefault();
      if (socket && inputVal) {
        socket.emit("telnet_input", inputVal + "\t");
        setInputVal("");
      }
    } else if (e.ctrlKey && e.key === "c") {
      e.preventDefault();
      sendCtrlC();
    }
  };

  const sendCtrlC = () => {
    if (socket) {
      socket.emit("telnet_input", "\x03");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-2 sm:p-4">
      <div className="bg-slate-900 border border-slate-700 shadow-2xl rounded-xl w-full max-w-5xl h-[85vh] max-h-[720px] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
        
        {/* Terminal Header */}
        <div className="p-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Terminal size={16} className="text-purple-400 flex-shrink-0" />
            <span className="font-bold text-slate-100 text-xs md:text-sm truncate">
              Web Telnet CLI —{" "}
              {device?.prefix || device?.mikrotik_alias || "MikroTik"}
            </span>
            <span className="font-mono text-[11px] text-purple-300 bg-purple-950/60 border border-purple-800/40 px-2 py-0.5 rounded hidden sm:inline-block">
              {device?.remote_address}:23
            </span>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Status Pill */}
            {status.connecting ? (
              <span className="text-[10px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded flex items-center gap-1">
                <RefreshCw size={10} className="animate-spin" /> Connecting
              </span>
            ) : status.connected ? (
              <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>{" "}
                Online
              </span>
            ) : (
              <span className="text-[10px] font-semibold text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded">
                Disconnected
              </span>
            )}

            <button
              type="button"
              onClick={connectTelnet}
              title="Hubungkan Ulang"
              className="p-1 text-slate-400 hover:text-white transition cursor-pointer"
            >
              <RefreshCw
                size={14}
                className={status.connecting ? "animate-spin" : ""}
              />
            </button>

            <button
              type="button"
              onClick={() => setLines([])}
              title="Bersihkan Layar"
              className="p-1 text-slate-400 hover:text-amber-400 transition cursor-pointer"
            >
              <Trash2 size={14} />
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-red-400 transition cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Terminal Screen Body */}
        <div
          onClick={() => inputRef.current?.focus()}
          className="flex-1 bg-black p-4 overflow-x-auto overflow-y-auto font-mono text-[11px] md:text-xs text-slate-200 leading-relaxed custom-scrollbar whitespace-pre select-text cursor-text"
        >
          {lines.map((line, index) => (
            <div
              key={index}
              className="min-h-[18px]"
              dangerouslySetInnerHTML={{ __html: parseAnsiToHtml(line) }}
            />
          ))}
          <div ref={terminalEndRef} />
        </div>

        {/* Quick Commands & Terminal Input Bar */}
        <div className="p-2.5 bg-slate-950 border-t border-slate-800 flex flex-col gap-2 flex-shrink-0">
          {/* Quick Command Pills */}
          {status.connected && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] font-mono no-scrollbar">
              <span className="text-[10px] text-slate-500 font-sans flex-shrink-0">Quick Cmd:</span>
              {[
                { label: "Lease Detail", cmd: "ip dhcp-server lease print detail" },
                { label: "Lease Terse", cmd: "ip dhcp-server lease print terse" },
                { label: "IP Address", cmd: "ip address print" },
                { label: "Interface", cmd: "interface print" },
                { label: "Log", cmd: "log print" },
                { label: "Ping Gateway", cmd: "ping 172.16.0.1 count=4" },
                { label: "Ping Google", cmd: "ping 8.8.8.8 count=4" },
                { label: "Quit", cmd: "quit" },
              ].map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    if (socket && status.connected) {
                      socket.emit("telnet_input", `${item.cmd}\r\n`);
                      inputRef.current?.focus();
                    }
                  }}
                  className="px-2 py-0.5 bg-slate-800/80 hover:bg-purple-900/40 text-slate-300 hover:text-purple-200 border border-slate-700 hover:border-purple-600/50 rounded text-[10px] transition cursor-pointer flex-shrink-0"
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between text-[10px] text-slate-500 px-1">
            <span className="flex items-center gap-2 flex-wrap">
              <span>
                Ketik perintah lalu tekan <b>Enter</b>
              </span>
              <span>•</span>
              <span>
                <b>Tab</b> (Auto-complete)
              </span>
              <span>•</span>
              <span>
                <b>Ctrl+C</b> / Batal
              </span>
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={sendCtrlC}
                className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition cursor-pointer text-[10px]"
              >
                Ctrl+C
              </button>
              <button
                type="button"
                onClick={() => {
                  socket?.emit("telnet_input", "\r\n");
                }}
                className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition cursor-pointer text-[10px] flex items-center gap-1"
              >
                <CornerDownLeft size={10} /> Enter
              </button>
            </div>
          </div>

          <form onSubmit={handleSendInput} className="flex items-center gap-2">
            <div className="relative flex-1">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-purple-400 font-mono font-bold text-xs">
                &gt;
              </span>
              <input
                ref={inputRef}
                type="text"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Masukkan username / password / perintah MikroTik..."
                disabled={!status.connected && !status.connecting}
                className="w-full bg-slate-900 border border-slate-700 focus:border-purple-500 rounded-lg pl-7 pr-3 py-1.5 text-xs font-mono text-slate-100 outline-none disabled:opacity-50"
              />
            </div>

            <button
              type="submit"
              disabled={!status.connected && !status.connecting}
              className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-medium transition flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Send size={12} /> Kirim
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
