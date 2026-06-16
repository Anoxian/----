# Product Requirements

## Project Background

- This is a Next.js + Supabase project.
- Future development should follow the existing tech stack, directory structure, and code style in this repository.
- The product serves students in real job-seeking scenarios.
- Students face two major pain points:
  - Searching through a large number of job postings to find opportunities that match their background, abilities, strengths, and career interests takes too much time.
  - After finding an interesting role, students are often unsure how well their resume matches the JD, what gaps exist, and how to optimize the resume to improve screening pass rate.
- The product direction is a canvas-based AI conversation product focused on job matching and resume optimization.
- Canvas mode is chosen to solve the problem of long AI context and too many generated files. By showing outputs as connected text blocks on a canvas, users can understand the logic and iteration process more clearly.

## Documentation Structure

- Related project documentation is stored under `docs/`.
- `docs/prd.md`: product requirements, feature specs, and confirmed product decisions.
- `docs/images/`: screenshots, UI references, flowcharts, and image assets.
- `docs/api/`: API docs, interface contracts, and third-party integration notes.

## Requirement Capture Rules

- When feature implementation, product requirements, business rules, or interaction details are confirmed, record them in this document promptly.
- Do not treat unconfirmed guesses as final requirements.
- If requirements are incomplete, record them under "Pending Questions" or "Open Issues" first.

## Confirmed Requirements

### Product Goal

- Build an AI job-seeking matching agent for students.
- Help students efficiently discover suitable roles.
- Help students improve the initial resume screening hit rate for target roles.
- The core experience should feel like a focused AI workspace, not a generic chatbot.
- The product should make the iteration process visible. Each generated result and each later revision should appear as separate but connected canvas blocks, so the user can understand how the analysis and resume evolved.
- When the user first enters the product, the assistant should actively greet the user and guide them to provide resume information, career preferences, and/or JD files before generating results.

### Deployment Direction

- The current deployment direction is to make the Next.js application externally accessible without using Cloudbase.
- Supabase remains the backend for authentication, database persistence, and file storage.
- The Next.js frontend should be deployed to a Next.js-compatible hosting platform or exposed through a temporary public tunnel during validation.

### Public Home Page

- The public home page must not show generic Next.js, Supabase, Vercel, tutorial, or starter-template content.
- The public home page should only keep the project name and login/register entry points.

### Authentication Pages

- Login and registration pages should use the product's own visual identity instead of starter-template copy or generic English auth UI.
- Authentication pages should continue using the existing Next.js React stack, Tailwind CSS, shadcn/ui, and lucide-react instead of introducing a separate frontend framework.
- The login page visual direction should use a dark, shader-inspired aesthetic with subtle mesh texture, restrained orange accent, and a clear login form. Do not introduce heavy 3D rendering dependencies unless a later interaction specifically requires them.

### Protected Page: AI Resume And JD Canvas

- Reference design: `docs/images/image.png`.
- Target page: `/protected`.
- The `/protected` page should be designed as a canvas-based AI workspace similar to the reference image:
  - A main canvas area for generated structured content.
  - A conversation/input area for the user to enter prompts and trigger generation.
  - The visual direction should follow the existing project stack and style conventions.
- The input box must allow the user to enter prompt text.
- The upload button inside the input area must keep a single menu and provide two choices: upload resume and upload JD.
- Resume and JD uploads must support images, Markdown, and Word documents.
- Supported upload formats: PNG, JPG, JPEG, WebP, MD, DOC, and DOCX.
- After the user clicks send, the canvas should automatically generate the following content based on the conversation and uploaded files:
  - User persona
  - Recommended jobs
  - JD match analysis
  - Optimized resume
- Canvas output must preserve a clear left-to-right reading order:
  - First, analyze the user persona.
  - Then, recommend suitable job directions. The first recommendation output should include at least five roles or role directions.
  - Then, guide the user to upload or send a JD for deeper analysis.
  - After receiving the JD, output JD match analysis, resume optimization suggestions, and optimized resume versions.
- Each user turn should create a new user input block that records the actual prompt and uploaded files.
- If a user turn only uploads or discusses a JD, the system should reuse the latest existing user persona instead of regenerating a new persona block by default.
- JD-focused turns should proceed directly to JD match analysis, resume optimization suggestions, and optimized resume versions unless the user explicitly asks to update the persona or role recommendations.
- If a JD image or file cannot be read or visually recognized, the assistant must not fabricate JD details, match scores, suggestions, or resume content. It should record the upload and ask the user to paste JD text or upload a clearer supported file.
- For JD screenshots and other uploaded images, the server should run OCR before JD analysis. The AI model should receive the OCR text instead of the raw image. The recognized text or failure reason should be reflected in the current user input block so the user can tell whether the image was actually read.
- Each canvas text block should have a single responsibility. For example:
  - One block only contains user persona.
  - One block only contains recommended jobs.
  - One block only contains JD match score and analysis.
  - One block only contains resume optimization suggestions.
  - One block only contains the optimized resume.
- Different versions of the optimized resume must all remain visible on the canvas instead of replacing older versions.
- Canvas blocks should be connected with lines to show logical relationships and iteration paths.
- Nodes created in the same generation should keep visible connecting lines between adjacent logical steps. If a stored edge is missing, the canvas should still infer and display a non-destructive fallback connection.
- Canvas text blocks should automatically grow to fit generated content by default, especially for long recommendations, analysis, and resume versions.
- Users must be able to resize canvas text blocks manually, and manually adjusted dimensions should be preserved.
- Users must be able to drag canvas text blocks freely. Manually adjusted positions should be preserved and should take priority over automatic layout.
- Canvas text blocks must not overlap each other. New generations should be placed where they do not cover older canvas content.
- Canvas text block content should render Markdown for readability instead of showing raw Markdown source text.
- Nodes created in the same generation should keep their top edges aligned on the same horizontal line when possible, while still preserving non-overlap.
- Generated canvas content must be persisted to Supabase.
- Generated results must support export. Markdown export is the priority for the first version.
- AI calls must run on the server side. The browser must not receive provider API tokens.
- The protected page should remain authenticated. Unauthenticated users should continue to be redirected to login.

### AI Agent Behavior

- The agent should use the student's resume information, uploaded JD images, and conversation prompt as input.
- The agent should extract and structure the following information where possible:
  - Student background, skills, experience, strengths, and career interests.
  - JD role title, responsibilities, requirements, preferred qualifications, and implicit screening signals.
- The generated output should prioritize practical job-search usefulness:
  - Explain why a role is recommended.
  - Point out match strengths and gaps.
  - Give resume optimization suggestions tied to the JD.
  - Produce a complete optimized resume in plain text.
- The first version must support both Chinese and English resumes/JDs.
- Job recommendations should be based on user-uploaded or user-provided JD content. The first version does not need to connect to external job boards or job databases.
- Before a JD is provided, the agent may recommend suitable role directions based on the resume/persona. After a JD is provided, recommendation and matching should be grounded in the user-provided JD content.
- After resume optimization suggestions are generated, the assistant should not automatically generate a full optimized resume. It should first ask whether the user needs an optimized resume. If the user needs one, the assistant should actively ask for missing details in the chat, such as target version, real experience details, quantifiable outcomes, skill proficiency, portfolio links, city, and language. It should continue asking until the user says they no longer need the optimized resume or enough information has been collected to generate a truthful complete resume.
- After recommended job directions are generated, the user may ask about a specific role. The app should create an independent job detail canvas node for that role so the user can quickly understand it. Follow-up questions about the same role should create iterative versions, named `{specific role name}介绍V1`, `{specific role name}介绍V2`, `{specific role name}介绍V3`, and so on.
- The agent should include offer-oriented methods:
  - Analyze JD requirements and decide whether the role is worth applying to.
  - Score resume/JD match.
  - Identify required skills, preferred skills, keywords, strengths, gaps, and red flags.
  - Optimize resume content truthfully for a target JD.
  - Check ATS-oriented keyword coverage and formatting risks.
  - Translate transferable skills when the student is changing career direction or applying across industries.

## Pending Questions

No pending questions yet.

## Open Issues

No open issues yet.
