import java.io.BufferedReader;
import java.io.File;
import java.io.InputStreamReader;
import java.util.ArrayList;
import location.Algorithms;
import location.LogRecord;
import location.RadioMap;

// REA runner scaffolding: args = <radiomap-mean file> <algorithm 1..4>; stdin = "bssid rss" lines.
// Calls UNMODIFIED upstream Algorithms.ProcessingAlgorithms and prints its raw String result (or "null").
public final class Runner {
    public static void main(String[] args) throws Exception {
        RadioMap rm = new RadioMap(new File(args[0]));
        int algorithm = Integer.parseInt(args[1]);
        ArrayList<LogRecord> scan = new ArrayList<>();
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
        String line;
        while ((line = in.readLine()) != null) {
            String[] parts = line.trim().split(" ");
            if (parts.length == 2) scan.add(new LogRecord(parts[0], Integer.parseInt(parts[1])));
        }
        String result = Algorithms.ProcessingAlgorithms(scan, rm, algorithm);
        System.out.print(result == null ? "null" : result);
    }
}
