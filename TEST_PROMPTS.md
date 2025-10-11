# Test Prompts for LLM-Controlled Browser

Once you start your Next.js app (`npm run dev`), try these prompts in the chat:

## Basic Navigation Tests

```
Go to example.com and tell me what you see
```

```
Navigate to httpbin.org/forms/post and describe the form fields
```

## Job Search Tests (Real Use Case)

```
Go to LinkedIn jobs page and search for "software engineer" in "San Francisco"
```

```
Navigate to Indeed.com, search for "frontend developer" jobs in "remote" 
locations, and show me the first 3 results
```

## Interactive Form Tests

```
Go to httpbin.org/forms/post, fill out the customer name field with "Test User", 
and the email field with "test@example.com", then tell me what other fields 
are available
```

## Data Extraction Tests

```
Go to news.ycombinator.com and tell me the top 5 story titles
```

```
Navigate to github.com/trending and extract the top 3 trending repositories
```

## Multi-Step Workflow Tests

```
Go to LinkedIn, search for "machine learning engineer" jobs, 
click on the first result, and tell me the job description and requirements
```

```
Navigate to a job search site, find a software engineer position, 
and tell me if I should apply based on my profile
```

## Advanced Tests

```
Go to example.com, take a screenshot, and describe what's on the page
```

```
Navigate to any website and execute JavaScript to count how many links are on the page
```

---

## Expected Behavior

Claude should:
1. Use `browser_navigate` to go to URLs
2. Use `browser_snapshot` to see page structure
3. Use `browser_click`, `browser_type`, `browser_select` for interactions
4. Use `browser_evaluate` to extract data
5. Use `browser_get_content` for full page text
6. Intelligently chain actions to complete complex tasks
7. Close sessions with `browser_close_session` when done

## Debugging

If Claude isn't using browser tools:
- Check `.claude/agents/job-assistant-agent.md` includes browser tool instructions
- Check Railway logs: `railway logs` (if deployed) or check browser-service console
- Verify `BROWSER_SERVICE_URL` and `BROWSER_SERVICE_API_KEY` in `.env.local`

