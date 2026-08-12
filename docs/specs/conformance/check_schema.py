import json, copy
from jsonschema import Draft202012Validator

s = json.load(open('/workspace/docs/specs/grahm-bundle-v1.schema.json'))
Draft202012Validator.check_schema(s)
print("SCHEMA VALID (Draft 2020-12)\n")
v = Draft202012Validator(s)

probe = {
    "kind": "functional",
    "request": {"method": "POST", "path": "/route"},
    "expect": {"status": 200, "assertions": [
        {"jsonPath": "$.distance_m", "withinTolerance": {"goldenValue": 94.0, "tolerancePercent": 5}}]},
    "run_when": ["post_apply", "periodic"],
    "interval_seconds": 30,
}

doc = {
  "apiVersion": "grahmos.io/bundle/v1", "kind": "Bundle",
  "metadata": {"name": "hospital", "version": "1.4.7", "title": "Hospital Continuity Bundle",
               "vendor": "GrahmOS", "created": "2026-08-12T00:00:00Z"},
  "capabilities": {
      "provides": [{"capability": "cap:routing.pedestrian.indoor@1", "version": "1.0.0",
                    "providedBy": "valhalla", "probe": probe}],
      "requires": [{"capability": "cap:facility.truth@1", "range": ">=1.0.0 <2.0.0"}]},
  "hardware": {"uptime_class": "ORB-2", "ram": "16GiB", "storage": "80GiB", "networking": ["wifi", "ethernet"]},
  "services": {"components": [{"id": "valhalla",
                "image": "ghcr.io/grahmos/valhalla@sha256:" + "a"*64,
                "degradedMode": {"capabilitiesLost": ["cap:routing.pedestrian.indoor@1"],
                                 "userMessage": "Indoor routing unavailable; map and search still local."}}]},
  "policies": {
      "degradation": {"answerPolicy": "degraded_with_receipt", "refusalAllowed": True},
      "identity": {"max_grace_seconds": 3600},
      "breakGlass": {"quorum": 2, "max_duration_minutes": 60,
                     "requires_audit_entry": True, "may_write_facility_verification": False}},
  "integrity": {
      "canonicalization": "RFC8785",
      "signatures": [{"role": "bundle_author", "keyId": "k-rel", "algorithm": "ed25519", "mode": "keyed"}],
      "trustAnchor": {"mediaType": "application/vnd.grahmos.trustanchor.v1+json",
                      "digest": "sha256:" + "b"*64, "expires": "2027-01-01T00:00:00Z",
                      "keys": [{"keyId": "k-rel", "role": "bundle_author", "publicKey": "PEM"}]},
      "tuf": {"root_digest": "sha256:" + "c"*64, "snapshot_version": 12, "expires": "2026-11-01T00:00:00Z"},
      "revocation_epoch_floor": 3},
  "qualification": {
      "requiredTests": ["Q-01", "Q-08", "Q-09", "Q-10", "Q-11", "Q-12", "Q-16", "Q-17a", "Q-17b", "Q-21"],
      "minimumGrade": "A", "enforcement": "enforcing",
      "hardwareClassMatrix": [{"uptime_class": "ORB-2", "minimumGrade": "A"},
                              {"uptime_class": "ORB-1", "minimumGrade": "B"}]},
}

errs = list(v.iter_errors(doc))
print("POSITIVE fixture:", "PASS" if not errs else "FAIL -> " + str([e.message for e in errs]))
print()

def mutate(fn):
    d = copy.deepcopy(doc); fn(d); return d

def rm_probe(d):   del d["capabilities"]["provides"][0]["probe"]
def floating(d):   d["capabilities"]["requires"][0]["range"] = "*"
def latest(d):     d["capabilities"]["requires"][0]["range"] = "latest"
def no_svc(d):     del d["services"]
def keyless(d):    d["integrity"]["signatures"][0]["mode"] = "keyless"
def only_qual(d):  d["integrity"]["signatures"] = [{"role":"qualification_authority","keyId":"kq","algorithm":"ed25519","mode":"keyed"}]
def no_anchor(d):  del d["integrity"]["trustAnchor"]
def no_tuf(d):     del d["integrity"]["tuf"]
def no_matrix(d):  del d["qualification"]["hardwareClassMatrix"]
def thin_tests(d): d["qualification"]["requiredTests"] = ["Q-01"]
def no_qual(d):    del d["qualification"]
def no_pol(d):     del d["policies"]
def no_bg(d):      del d["policies"]["breakGlass"]
def advisory_a(d): d["qualification"]["enforcement"] = "advisory"
def liveness(d):   d["capabilities"]["provides"][0]["probe"]["expect"] = {"status":200,"assertions":[]}
def status_only(d):d["capabilities"]["provides"][0]["probe"]["expect"] = {"status":200}
def no_interval(d):del d["capabilities"]["provides"][0]["probe"]["interval_seconds"]
def tag_img(d):    d["services"]["components"][0]["image"] = "valhalla:latest"
def decimal(d):    d["hardware"]["ram"] = "16GB"
def badcap(d):     d["capabilities"]["provides"][0]["capability"] = "routing@1"
def quorum1(d):    d["policies"]["breakGlass"]["quorum"] = 1
def bg_verify(d):  d["policies"]["breakGlass"]["may_write_facility_verification"] = True
def opt_nodeg(d):  d["capabilities"]["requires"][0]["optional"] = True
def bad_q(d):      d["qualification"]["requiredTests"] = ["Q-99"] + d["qualification"]["requiredTests"]
def stale_data(d): d["data"] = {"datasets":[{"id":"tiles","mediaType":"x","digest":"sha256:"+"d"*64,
                                             "size":1,"delivery":"inline",
                                             "freshness":{"generated_at":"2026-01-01T00:00:00Z"},
                                             "provenance":{"source_kind":"osm","source_license":"ODbL-1.0",
                                                           "build_attestation":"sha256:"+"e"*64}}]}
def no_prov(d):    d["data"] = {"datasets":[{"id":"tiles","mediaType":"x","digest":"sha256:"+"d"*64,
                                             "size":1,"delivery":"inline",
                                             "freshness":{"generated_at":"2026-01-01T00:00:00Z",
                                                          "source_as_of":"2026-01-01T00:00:00Z","max_age_days":90}}]}
def no_degmode(d): del d["services"]["components"][0]["degradedMode"]["userMessage"]

cases = [
 ("B-202  provided capability with no probe", rm_probe),
 ("B-203  floating range '*'", floating),
 ("B-203  floating range 'latest'", latest),
 ("B-201  no services block at all", no_svc),
 ("B-703  keyless signing mode", keyless),
 ("B-702a only qualification_authority signature", only_qual),
 ("B-704  no in-band trust anchor", no_anchor),
 ("       no TUF freshness metadata", no_tuf),
 ("B-902  grade unqualified by hardware class", no_matrix),
 ("B-903  requiredTests below mandatory floor", thin_tests),
 ("B-903  qualification block omitted entirely", no_qual),
 ("       policies block omitted entirely", no_pol),
 ("B-604  breakGlass policy omitted", no_bg),
 ("B-904  advisory enforcement claiming grade A", advisory_a),
 ("B-202a probe with empty assertions", liveness),
 ("B-202a probe with status only", status_only),
 ("B-206  periodic probe with no interval", no_interval),
 ("B-501  image tag instead of digest", tag_img),
 ("       decimal byte units '16GB'", decimal),
 ("       malformed capability id", badcap),
 ("B-607  break-glass quorum of 1", quorum1),
 ("B-608  break-glass may write verification", bg_verify),
 ("B-203a optional require w/o degradedWithout", opt_nodeg),
 ("       unknown Q-test id Q-99", bad_q),
 ("B-402a dataset freshness w/o source_as_of", stale_data),
 ("B-403  dataset without build provenance", no_prov),
 ("B-503  degradedMode without userMessage", no_degmode),
]

bad = 0
for name, fn in cases:
    e = list(v.iter_errors(mutate(fn)))
    ok = "REJECTED" if e else "*** NOT REJECTED ***"
    if not e: bad += 1
    print(f"  {ok:22} {name}")
print(f"\n{len(cases)-bad}/{len(cases)} negative fixtures correctly rejected.")
