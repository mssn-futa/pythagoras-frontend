# Contributing to Project Pythagoras (Frontend)

**In the name of Allah, the Most Gracious, the Most Merciful.**

Welcome to the **Frontend Team** of Project Pythagoras! We are building the user interface that connects Muslim students at FUTA to their spiritual and academic growth.

This document is your rulebook. Please read it carefully before writing any code.

## The 3-Month Roadmap

We are tackling this project in three distinct phases.

* **Phase 1: The Dawah Component (Month 1)**  
  * *Focus:* Student Dashboard, Login/Register UI, Audio Player (Khutbahs), Email Subscription Forms.  
* **Phase 2: The Academic Component (Month 2)** 
  * *Focus:* CBT Practice Interface, PDF Library UI, Study Group Chat UI.  
* **Phase 3: The Empowerment Hub (Month 3)**
  * *Focus:* Job Board UI, Mentorship Profile Cards.

## The "3-Day Rule"

We value your time and your academic commitments. To prevent burnout:

**No Clickup task card should take longer than 3 days to complete.**

* If a task looks like it will take 5 days, **do not start it**.  
* Instead, ask your Frontend Lead to break it down (e.g., split *"Build Dashboard"* into *"Build Sidebar"* and *"Build Stats Cards"*).  
* If you are blocked (e.g., API is down), raise a flag in the group chat immediately.

## Getting Started

### 1. Prerequisites

Ensure you have the following installed:

* **Node.js** (v18 or higher) - [Download](https://nodejs.org/)  
* **Git** - [Download](https://git-scm.com/)  
* **VS Code** (Recommended)  
  * *Recommended Extensions:* ES7+ React Snippets, Tailwind CSS IntelliSense, Prettier.

### 2. Setup

1. **Fork** the frontend repository to your GitHub account.  
2. **Clone** your fork:

```nginx
git clone [https://github.com/mssn-futa/pythagoras-frontend.git](https://github.com/mssn-futa/pythagoras-frontend.git)
cd pythagoras-frontend
```

3. **Install Dependencies**:

```nginx
npm install
```
   
6. **Environment Variables** (Don't worry about this for now):  
   * Copy .env.example to .env.  
   * Set your API URL:

```nginx
VITE_API_URL=http://localhost:8000/api/v1
```
 
7. **Run Development Server**:

```nginx
npm run dev
```


## **The Workflow (Clickup -> Git -> PR)**

We follow a strict **Feature Branch Workflow**.

### **Step 1: Claim a Task**

1. Go to our **Clickup Board**.  
2. Find a card assigned to you in the **"To Do"** column (example; "Build Login Form").
4. Ask any clarifying questions and make sure you get all information that you need.
3. Start the task and move it to **"In Progress"**.

### **Step 2: Create a Branch**

Naming Convention: `type/feature-name`

* **Types:** feat (new UI/logic), fix (bug fix), style (Tailwind tweaks), refactor.  
* **Example:** `feat/login-form-ui`, `fix/audio-player`

```nginx
git checkout -b feat/login-form-ui
```

### **Step 3: Code & Commit**

* **Bad Message:** done styling  
* **Good Message:** style: added responsive padding to login card

### **Step 4: Pull Request (PR)**

1. Push to your fork: `git push origin feat/login-form-ui` 
2. Open a PR to the `dev` branch.  
3. **Self-Review:** 
    - Did you remove `console.log`? 
    - Does it look good on mobile? 
    - Is it working as described on Clickup? 
    - Are you proud of it?

## **Frontend Coding Standards**

### **1. Folder Structure (Feature-First)**

We do not group by "components" or "hooks" globally. We group by **Feature**. Check the `ARCHITECTURE.md` file for a better understanding.

* `src/features/auth/components/LoginForm.jsx`
* `src/components/LoginForm.jsx`

### **2. React Components**

* **Naming:** Use PascalCase for filenames and components (e.g, `KhutbahCard.jsx`).  
* **Functional Only:** Use functional components with Hooks. No Class components.  
* **Prop Types:** Explicitly define props.

### **3. Styling (Tailwind CSS)**

* **Utility First:** Use Tailwind classes directly.  
  * `<div className="p-4 bg-green-500 rounded-lg">`
  * `<div className="my-custom-card">` (Avoid CSS files unless for complex animations...and I don't think we have any of those).  
* **Mobile First:** Write mobile styles first, then add `md:` or `lg:`.  
  * `className="w-full md:w-1/2"` (Full width on mobile, half on desktop).

### **4. State Management**

* **Server State:** Use **React Query** (TanStack Query) for fetching data. Do not use useEffect for API calls.  
* **Local State:** Use `useState` for simple UI toggles (modals, dropdowns).

## **Need Help?**

1. Check the **Figma Design** links in the Clickup card.  
2. Google the error + "React Vite".
3. Reach out to the Frontend or Team Lead
3. Ask on the group!


End :))

**JazakumuLlaahu Khayran!**
