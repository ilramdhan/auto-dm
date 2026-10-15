# Changelog

## [0.6.2](https://github.com/ilramdhan/auto-dm/compare/v0.6.1...v0.6.2) (2026-10-15)


### Bug Fixes

* point every repository and image link at ilramdhan/auto-dm ([#94](https://github.com/ilramdhan/auto-dm/issues/94)) ([91a6d8e](https://github.com/ilramdhan/auto-dm/commit/91a6d8ef08eaabece174bce5023f7bc6d5ef31db))

## [0.6.1](https://github.com/ilramdhan/auto-dm/compare/v0.6.0...v0.6.1) (2026-10-15)


### Bug Fixes

* **pwa:** reload stale installed apps after a deploy and make sign-out work without JavaScript ([#92](https://github.com/ilramdhan/auto-dm/issues/92)) ([b046dc6](https://github.com/ilramdhan/auto-dm/commit/b046dc6623dba32317f6c017b7398f455509c227))


### Performance

* **analytics:** stream sections and cut database round trips ([#90](https://github.com/ilramdhan/auto-dm/issues/90)) ([23cc49a](https://github.com/ilramdhan/auto-dm/commit/23cc49ac6d1292db401b6a9917b832ceabd6df82)), closes [#86](https://github.com/ilramdhan/auto-dm/issues/86)

## [0.6.0](https://github.com/ilramdhan/auto-dm/compare/v0.5.1...v0.6.0) (2026-10-15)


### Features

* auto-delete comment records after a configurable retention period ([#77](https://github.com/ilramdhan/auto-dm/issues/77)) ([a3ecbeb](https://github.com/ilramdhan/auto-dm/commit/a3ecbeb5f1b3a4d247b80a78180a7338f9e19883)), closes [#66](https://github.com/ilramdhan/auto-dm/issues/66)
* download Activity and Analytics as CSV ([#79](https://github.com/ilramdhan/auto-dm/issues/79)) ([72e943f](https://github.com/ilramdhan/auto-dm/commit/72e943fbd245920e6c0ccd1474de8c999852faca)), closes [#65](https://github.com/ilramdhan/auto-dm/issues/65)
* rename the project to AutoDM (slug: autodm) ([#76](https://github.com/ilramdhan/auto-dm/issues/76)) ([70c711b](https://github.com/ilramdhan/auto-dm/commit/70c711b9e066a6d3f43195b378782df9dcde5dd0)), closes [#63](https://github.com/ilramdhan/auto-dm/issues/63)
* **site:** full public website with features, setup guide, pricing and FAQ ([#84](https://github.com/ilramdhan/auto-dm/issues/84)) ([8bb1e1c](https://github.com/ilramdhan/auto-dm/commit/8bb1e1ce716b968a26db3eed3e13b4fd2aa4d627))
* **webhook:** show recent webhook deliveries and explain why a comment did nothing ([#83](https://github.com/ilramdhan/auto-dm/issues/83)) ([4e8a7e2](https://github.com/ilramdhan/auto-dm/commit/4e8a7e2d03de7a1a06dca284abb1923420cbd041))


### Bug Fixes

* recover from stale DB connections and version skew on first load ([#85](https://github.com/ilramdhan/auto-dm/issues/85)) ([fef1766](https://github.com/ilramdhan/auto-dm/commit/fef17662245cbfa79f51382d9af1b63eb1ab0687))


### Documentation

* retake README screenshots with the AutoDM name ([#82](https://github.com/ilramdhan/auto-dm/issues/82)) ([678ded7](https://github.com/ilramdhan/auto-dm/commit/678ded7568d43aa17c9875ed6c5c9a881fea0bef))

## [0.5.1](https://github.com/ilramdhan/auto-reply-ig/compare/v0.5.0...v0.5.1) (2026-10-15)


### Documentation

* README banner, screenshots and social preview ([#61](https://github.com/ilramdhan/auto-reply-ig/issues/61)) ([88f56c7](https://github.com/ilramdhan/auto-reply-ig/commit/88f56c70162e2ec457de3750f1e32db9b85c0d7d)), closes [#52](https://github.com/ilramdhan/auto-reply-ig/issues/52)

## [0.5.0](https://github.com/ilramdhan/auto-reply-ig/compare/v0.4.0...v0.5.0) (2026-10-15)


### Features

* brand icons, social cards, SEO metadata and installable PWA ([#60](https://github.com/ilramdhan/auto-reply-ig/issues/60)) ([cb2cb29](https://github.com/ilramdhan/auto-reply-ig/commit/cb2cb296dc6107dd642d8915d7e3b1d9db73a364)), closes [#49](https://github.com/ilramdhan/auto-reply-ig/issues/49)
* let the operator delete a commenter's data ([#55](https://github.com/ilramdhan/auto-reply-ig/issues/55)) ([c734f2c](https://github.com/ilramdhan/auto-reply-ig/commit/c734f2c56bece548b537f2e27189158cb81ffc51)), closes [#53](https://github.com/ilramdhan/auto-reply-ig/issues/53)
* **log:** request ids, unhandled error logging and central redaction ([#57](https://github.com/ilramdhan/auto-reply-ig/issues/57)) ([2828bbf](https://github.com/ilramdhan/auto-reply-ig/commit/2828bbf4e5d8ff9199d89eed373ac38f0c703332)), closes [#51](https://github.com/ilramdhan/auto-reply-ig/issues/51)
* **settings:** add an About tab with version, update check and changelog ([#59](https://github.com/ilramdhan/auto-reply-ig/issues/59)) ([77d04b7](https://github.com/ilramdhan/auto-reply-ig/commit/77d04b78a52fe331735a4d548d089ee3ef22bc26))

## [0.4.0](https://github.com/ilramdhan/auto-reply-ig/compare/v0.3.0...v0.4.0) (2026-10-15)


### Features

* terms of service page and legal links on every public page ([#47](https://github.com/ilramdhan/auto-reply-ig/issues/47)) ([5472355](https://github.com/ilramdhan/auto-reply-ig/commit/54723550d0d634e7faf9418dfc039c67ffb63aaa)), closes [#46](https://github.com/ilramdhan/auto-reply-ig/issues/46)


### Bug Fixes

* **db:** fail fast on unreachable DB; document matching the Vercel function region ([#45](https://github.com/ilramdhan/auto-reply-ig/issues/45)) ([779308a](https://github.com/ilramdhan/auto-reply-ig/commit/779308af9e1383caf25834ba16db3e1419379177)), closes [#44](https://github.com/ilramdhan/auto-reply-ig/issues/44)

## [0.3.0](https://github.com/ilramdhan/auto-reply-ig/compare/v0.2.0...v0.3.0) (2026-10-15)


### Features

* privacy policy, data deletion page and Meta deletion callbacks ([#43](https://github.com/ilramdhan/auto-reply-ig/issues/43)) ([c296db2](https://github.com/ilramdhan/auto-reply-ig/commit/c296db242af0eea27800ae484da7d0a062f88892)), closes [#42](https://github.com/ilramdhan/auto-reply-ig/issues/42)


### Bug Fixes

* **migrate:** adopt migrations run by hand; rewrite the setup guide ([#39](https://github.com/ilramdhan/auto-reply-ig/issues/39)) ([9c78393](https://github.com/ilramdhan/auto-reply-ig/commit/9c783936aa01c3d468304d4b31bd744a9d55bf44))

## [0.2.0](https://github.com/ilramdhan/auto-reply-ig/compare/v0.1.0...v0.2.0) (2026-10-14)


### Features

* add a landing page and a setup notice for missing env vars ([#34](https://github.com/ilramdhan/auto-reply-ig/issues/34)) ([a9676cc](https://github.com/ilramdhan/auto-reply-ig/commit/a9676ccf1cb9e48ceac24e9bcb4cfe3461279b15))

## 0.1.0 (2026-10-14)


### Features

* add Docker image, automated releases and community templates ([#5](https://github.com/ilramdhan/auto-reply-ig/issues/5)) ([ccf92b7](https://github.com/ilramdhan/auto-reply-ig/commit/ccf92b798f55e9f0558a8fd47c07c499a866647e))
* auto-reply-ig — Instagram comment-to-DM automation (v0.1) ([#4](https://github.com/ilramdhan/auto-reply-ig/issues/4)) ([8301d48](https://github.com/ilramdhan/auto-reply-ig/commit/8301d48e8136f11c36a73c0c7cfafb8a5d0f7466))
* configurable time zone for analytics and a nonce-based CSP ([#11](https://github.com/ilramdhan/auto-reply-ig/issues/11)) ([3e7dc4c](https://github.com/ilramdhan/auto-reply-ig/commit/3e7dc4c2197346f8ea170d1045679ac0a17d04d4))


### Bug Fixes

* **release:** keep release-please output compatible with CI ([#30](https://github.com/ilramdhan/auto-reply-ig/issues/30)) ([a3021a8](https://github.com/ilramdhan/auto-reply-ig/commit/a3021a8744a8090d0ddad994e3e221ac8240fca4)), closes [#29](https://github.com/ilramdhan/auto-reply-ig/issues/29)
* **release:** let release-please write the first changelog ([#32](https://github.com/ilramdhan/auto-reply-ig/issues/32)) ([33fb038](https://github.com/ilramdhan/auto-reply-ig/commit/33fb03897fc6174a49f7834f03c653eea867c03b)), closes [#31](https://github.com/ilramdhan/auto-reply-ig/issues/31)
* **release:** start versioning at 0.1.0 ([#24](https://github.com/ilramdhan/auto-reply-ig/issues/24)) ([76e6034](https://github.com/ilramdhan/auto-reply-ig/commit/76e6034f91357d8e6f6e80419c28c3680e316e47)), closes [#25](https://github.com/ilramdhan/auto-reply-ig/issues/25)
