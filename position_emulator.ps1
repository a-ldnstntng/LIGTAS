Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public class WindowArranger {
    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

    [DllImport("user32.dll")]
    public static extern bool MoveWindow(IntPtr hWnd, int X, int Y, int nWidth, int nHeight, bool bRepaint);

    [DllImport("user32.dll")]
    public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);

    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    public static void PositionEmulator() {
        bool found = false;
        EnumWindows((hWnd, lParam) => {
            if (!IsWindowVisible(hWnd)) return true;
            StringBuilder sb = new StringBuilder(256);
            GetWindowText(hWnd, sb, 256);
            string title = sb.ToString();

            // Match Android emulator window
            if (title.Contains("Android Emulator") || title.Contains("medium_phone")) {
                Console.WriteLine("Found Emulator Window: " + title);
                // Position on right side of 1080p screen: X=1020, Y=30, Width=480, Height=800
                MoveWindow(hWnd, 1040, 20, 460, 800, true);
                SetForegroundWindow(hWnd);
                Console.WriteLine("Successfully repositioned emulator to the right side of the screen (X:1040, Y:20, W:460, H:800).");
                found = true;
            }
            return true;
        }, IntPtr.Zero);

        if (!found) {
            Console.WriteLine("Emulator window not found by title. Searching by process...");
            var procs = System.Diagnostics.Process.GetProcessesByName("qemu-system-x86_64");
            foreach (var p in procs) {
                if (p.MainWindowHandle != IntPtr.Zero) {
                    MoveWindow(p.MainWindowHandle, 1040, 20, 460, 800, true);
                    SetForegroundWindow(p.MainWindowHandle);
                    Console.WriteLine("Repositioned process window " + p.ProcessName);
                    found = true;
                }
            }
        }
    }
}
"@
[WindowArranger]::PositionEmulator()
