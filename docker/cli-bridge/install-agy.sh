#!/bin/sh
set -eu
# Pinned public release URLs/checksums from Google's official update manifests.
case "$1" in
  amd64)
    url="https://storage.googleapis.com/antigravity-public/antigravity-cli/1.3.4-5524158944247808/linux-x64/cli_linux_x64.tar.gz"
    sha="dbdacfc5a1d9874fbbea3a21026d3990b4728e2e3487fd0316dc53cae9a3091023f969425828f3e2e0fadda43cea07dd978ea96f4ca7c202adf2201f419c56dd"
    ;;
  arm64)
    url="https://storage.googleapis.com/antigravity-public/antigravity-cli/1.3.4-5524158944247808/linux-arm/cli_linux_arm64.tar.gz"
    sha="24a1d463319701f4943b2d4932cb86ca34d60d2e9fedcd9018ca31809773d719f272512068911632db175d7233088551033bcecc0a2a56b1bcfa041269687eaf"
    ;;
  *) echo 'AGY bridge supports amd64 and arm64 Linux images.' >&2; exit 1 ;;
esac
curl --fail --silent --show-error --location --retry 3 "$url" -o /tmp/agy.tar.gz
echo "$sha  /tmp/agy.tar.gz" | sha512sum --check --status
tar -xzf /tmp/agy.tar.gz -C /tmp antigravity
install -m 755 /tmp/antigravity /usr/local/bin/agy
rm /tmp/agy.tar.gz /tmp/antigravity
agy --version
