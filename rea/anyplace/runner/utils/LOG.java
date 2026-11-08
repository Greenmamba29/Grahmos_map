package utils;

// REA shim (runner scaffolding): upstream's LOG is a Scala object in the Play server. RadioMap.java only
// calls LOG.D(String) when a radio map can't be used; the runner sends that to stderr.
public final class LOG {
    private LOG() {}
    public static void D(String message) { System.err.println("LOG.D " + message); }
}
