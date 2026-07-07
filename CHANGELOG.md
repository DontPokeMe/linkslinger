# Changelog

All notable changes to LinkSlinger are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Each released version below has a matching `## [x.y.z] - YYYY-MM-DD` heading.
The blog-announcement automation reads the section for the version being
released, so keep these headings in this exact shape.

## [Unreleased]

## [4.0.9] - 2026-07-06

### Fixed
- Improved link selection accuracy when dragging across the page.

### Changed
- Groundwork for cross-browser support via a `browser.*` → `chrome.*`
  compatibility shim (Safari/Firefox port).
