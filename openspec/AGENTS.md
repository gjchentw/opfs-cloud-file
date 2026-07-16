# OpenSpec AI Agent Guidelines

## Scope

This document **exclusively** governs the writing of SDD (Spec-Driven Development) documents within the `openspec/` directory. It does **not** cover project code development specifications.

## Core Principle

All files within the `openspec/` directory MUST be written in English, regardless of file format or type.

## AI Agent Responsibilities

### Specification Writing
- AI Agents **must** write specification documents following OpenSpec best practices
- AI Agents **must** proactively guide human developers to adopt SDD development methodology

### Specification Compliance
- AI Agents must operate **only** within the scope of project specifications managed in the `openspec/` directory
- Project code implementation specifications are governed **solely** by the specs accepted and managed under `openspec/`

### Verification Duty
- At appropriate points in the SDD development cycle, AI Agents must compare relevant specifications with code implementation
- Verification must confirm a **perfect match** between specifications and implementation
- When any inconsistency is detected, AI Agents **must** honestly report it to the human operator
- AI Agents must **wait** for human operator to correct the inconsistency before proceeding

### Proactive Inquiry Duty
- AI Agents **must** actively question human developers when:
  - Specification lacks clarity, has ambiguity, or uses undefined terms
  - Specification may be incomplete or missing edge cases
  - Specification lacks verifiable acceptance criteria
  - Potential conflicts with existing specifications are detected
  - Technical feasibility or external dependencies are uncertain
  - Prioritization, scheduling, or workflow decisions need clarification

### Risk Assessment Duty
- AI Agents **must** proactively identify and raise:
  - Technical risks and unknowns that may impact implementation
  - Dependencies on external systems, APIs, or stakeholders
  - Impact assessment for specification changes on existing features
  - Prototyping needs for unproven technical approaches

## OpenSpec Workflow

### Document Management
- Use `openspec change` for proposing and tracking modifications
- Follow the spec-driven development approach: proposal → specs → design → tasks
- Maintain clear separation between delta specs and main specs

### Specification Standards
- Specifications must be precise, testable, and implementation-agnostic
- Use declarative language over imperative descriptions
- Include acceptance criteria for each specification

### Documentation Requirements
- All OpenSpec artifacts (specs, changes, designs, tasks) must be in English
- Use markdown format with clear structure and hierarchy
- Reference related artifacts using relative paths

## Quality Gates

1. **Clarity**: Specifications must be unambiguous
2. **Completeness**: All requirements must be explicitly stated
3. **Testability**: Every specification must have verifiable acceptance criteria
4. **Traceability**: Links between specs, changes, and implementations must be maintained

## File Structure

```
openspec/
├── specs/           # Main specifications (English only)
│   └── *.md
├── changes/         # Change proposals (English only)
│   └── *.md
├── designs/         # Design documents (English only)
│   └── *.md
├── tasks/           # Task lists (English only)
│   └── *.md
└── AGENTS.md        # This file
```

## Language Enforcement

- **Mandatory**: All content in `openspec/` directory MUST be in English
- **Exceptions**: None - this rule applies to all file types (.md, .json, .yaml, etc.)
- **Validation**: Review all new files in this directory for language compliance
