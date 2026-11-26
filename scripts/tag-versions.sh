#!/usr/bin/env bash
# Sets the SemVer tags (vX.Y.Z) on every commit of Betly and pushes them.
# Run once from the repository root:  bash scripts/tag-versions.sh
# Tags that already exist are left alone. From 2.22.0 on every commit message starts with its version. See CHANGELOG.md for what each version contains.
set -euo pipefail
while read -r sha ver; do
  [ -z "$sha" ] && continue
  if git rev-parse -q --verify "refs/tags/v$ver" >/dev/null; then continue; fi
  git tag -a "v$ver" "$sha" -m "Betly $ver"
done <<'LIST'
bd13e6e 0.0.0
ad4fc3c 0.1.0-alpha.1
3adbbd4 0.1.0-alpha.2
14b0716 0.1.0-alpha.3
2eeeaf1 0.1.0-alpha.4
3e50a58 0.1.0-alpha.5
f9aca86 0.1.0-beta.1
8c62ed8 0.1.0-beta.2
d204abd 0.1.0-beta.3
14b790f 0.1.0-beta.4
cc8990f 0.1.0-beta.5
5937935 0.1.0-beta.6
068fc55 0.1.0-beta.7
e91b57a 0.1.0-rc.1
b73b4e5 0.1.0-rc.2
d55d18b 0.1.0-rc.3
d011f85 0.1.0-rc.4
bfc1ffc 1.0.0
32f6459 1.0.1
77998cc 1.1.0
2016452 1.1.1
69c0e16 1.1.2
0b523eb 1.2.0
ca11928 1.2.1
e157d48 1.2.2
9d329cf 1.2.3
c759f78 1.2.4
c762bfb 1.3.0
7a660ed 1.3.1
6a6924a 1.3.2
4d443f4 1.4.0
7129ff3 1.4.1
3ecc8d7 1.4.2
9149ac8 1.4.3
d5a9794 1.4.4
252361b 1.5.0
537a65f 1.6.0
bc80682 1.6.1
1a3c30f 1.7.0
185c232 1.8.0
6d1b98d 1.9.0
4d0ce0f 1.9.1
ad8be62 1.9.2
f3e335e 1.9.3
7b1f7b4 1.9.4
68aceff 1.9.5
5075a1c 1.9.6
1469174 1.9.7
7e48f9a 1.9.8
f7650ac 1.10.0
50596b7 1.11.0
d791e62 1.11.1
e98ab26 1.12.0
cd58390 1.12.1
276e092 1.13.0
acdde88 1.13.1
88df985 2.0.0
38464c0 2.1.0
454d880 2.1.1
d7967b5 2.1.2
1fa999b 2.2.0
2bd30eb 2.2.1
5360c6f 2.2.2
a4c38e0 2.3.0
b14bec8 2.4.0
4cf15ff 2.4.1
2767fd0 2.4.2
4565816 2.5.0
cdf5593 2.5.1
a294f1e 2.5.2
6d1c223 2.6.0
7ccab85 2.6.1
15f7b2d 2.7.0
da2c098 2.8.0
66a662e 2.9.0
75ea369 2.10.0
a15439d 2.11.0
ce1d857 2.11.1
2033307 2.11.2
cec1399 2.11.3
40d93f9 2.12.0
a8b00a2 2.13.0
1b7bcd6 2.14.0
a073b33 2.15.0
0ea23ed 2.16.0
221339f 2.17.0
8d3e2e5 2.17.1
cae7310 2.18.0
a97b05e 2.19.0
1fe375a 2.20.0
9f2c2bc 2.20.1
ebe149c 2.21.0
0d9abc3 2.22.0
LIST
# newer commits carry their version at the start of the message ("v2.22.1: ...")
git log --format='%H %s' | while read -r sha subject; do
  ver=$(printf '%s' "$subject" | sed -nE 's/^v([0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.]+)?):.*/\1/p')
  [ -z "$ver" ] && continue
  git rev-parse -q --verify "refs/tags/v$ver" >/dev/null || git tag -a "v$ver" "$sha" -m "Betly $ver"
done
git push origin --tags
