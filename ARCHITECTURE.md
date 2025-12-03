# Frontend Architecture & Structure: Project Pythagoras

**Version:** 1.0 | **Phase:** 1 (Dawah Component)

**Stack:** JS + React + Vite + Tailwind CSS + React Query (TanStack Query) + Axios

## 1. High-Level Data Flow & Architecture

We strictly separate UI (View)** from **Logic (Hooks)** and **Data (API)**. This creates a predictable unidirectional data flow.

### The Data Flow Loop

When a user interacts with the application (e.g., plays a Khutbah or submits a Quiz), data flows through these layers:

```nginx

     VIEW LAYER               LOGIC LAYER               DATA LAYER             NETWORK LAYER

+-------------------+     +------------------+     +------------------+     +------------------+

|                   |     |                  |     |                  |     |                  |

|  Page / Screen    |---->|   Custom Hook    |---->|   React Query    |---->|   Axios Service  |

| (UI Components)   |     | (useKhutbahs.js) |     | (Cache / State)  |     |   (apiClient)    |

|                   |     |                  |     |                  |     |                  |

+-------------------+     +------------------+     +------------------+     +------------------+

         ^                         |                         |                        |

         |                         |                         |                        |

         +-------------------------+-------------------------+                        v

                 (Data Updates trigger Re-renders)                             [ Backend API ]
```


### **State Management Strategy**

"State" here is in two types:

1. **Server State (Remote):** Managed by **React Query**.  
   * *Examples:* List of Khutbahs, User Profile, Quiz Questions.  
   * *Why:* Handles caching, loading states, and error handling automatically.  
2. **Client State (Local/Global):** Managed by **React Context** (Global) or useState (Local).  
   * *Examples:* Auth Token (Context), Audio Player Status (Context), Modal Open/Close (Local).

## **2. Layered Separation of Concerns**

To ensure multiple people can work without conflict, we enforce strict boundaries inimplmentations.

```nginx
[src]

  |

  +-- [pages]      <-- ROUTING ONLY. No complex logic.

  |     |              Imports features and arranges layout.

  |     v

  +-- [features]   <-- BUSINESS LOGIC DOMAIN.

  |     |              (e.g., Auth, Dawah, Admin).

  |     |              Contains its own components, hooks, and types.

  |     v

  +-- [components] <-- SHARED UI.

  |                    (Buttons, Cards, Inputs). Pure & reusable.

  |

  +-- [lib]        <-- CONFIGURATION.

                       (Axios instance, Helper functions).
```


## **3. The File Structure (Project Structure)**

We will use a **Feature-Based Folder Structure**. This groups files by *what they do* rather than *what they are*. This is much easier for new contributors to navigate.

### **Directory Tree**

```nginx
src/

├── assets/                  # Static images, fonts, icons

├── components/              # SHARED atomic components (dumb components)

│   ├── ui/                  # Generic UI (Button.jsx, Input.jsx, Modal.jsx)

│   ├── layout/              # Layout shells (Sidebar.jsx, Navbar.jsx)

│   └── ProtectedRoute.jsx   # Auth Guard wrapper

├── context/                 # Global Client State

│   ├── AuthContext.jsx      # Stores User & Token

│   └── AudioContext.jsx     # Stores current playing Khutbah

├── features/                # THE CORE: Feature-specific logic/components

│   ├── auth/                # Feature: Authentication

│   │   ├── components/      # (LoginForm.jsx, RegisterForm.jsx)

│   │   ├── hooks/           # (useLogin.js, useRegister.js)

│   │   └── api/             # (authApi.js)

│   ├── dawah/               # Feature: Dawah & Content

│   │   ├── components/      # (KhutbahCard.jsx, EventList.jsx, PlayerControls.jsx)

│   │   ├── hooks/           # (useKhutbahs.js, useEvents.js)

│   │   └── api/             # (dawahApi.js)

│   └── admin/               # Feature: Admin Dashboard

│       ├── components/      # (UploadForm.jsx, UserTable.jsx, BroadcastEditor.jsx)

│       └── hooks/           # (useAdminStats.js)

├── hooks/                   # Generic hooks (useClickOutside, useMediaQuery)

├── lib/                     # Library setups

│   ├── axios.js             # Pre-configured axios instance (Base URL, Interceptors)

│   └── utils.js             # Helper functions (date formatters, cn)

├── pages/                   # ROUTES: The actual screens

│   ├── auth/                # (LoginPage.jsx, RegisterPage.jsx)

│   ├── student/             # (Dashboard.jsx, KhutbahsPage.jsx, QuizPage.jsx)

│   └── admin/               # (AdminDashboard.jsx, ContentManager.jsx)

├── App.jsx                  # Main Router Setup

└── main.jsx                 # Entry point (Providers wrapper)
```


## **4. Routing Architecture**

We separate routes into **Public**, **Student**, and **Admin**. The routing structure looks like this:

```jsx
<Routes>

  {/* Public routes */}

  <Route path="/login" element={<LoginPage />} />
  <Route path="/register" element={<RegisterPage />} />

  {/* Protected student routes */}

  <Route element={<ProtectedRoute role="student" />}>
    <Route element={<StudentLayout />}>
      <Route path="/" element={<Dashboard />} />
      <Route path="/khutbahs" element={<KhutbahsPage />} />
      <Route path="/quiz" element={<QuizPage />} />
    </Route>
  </Route>

  {/* Protected admin routes */}

  <Route element={<ProtectedRoute role="admin" />}>
    <Route element={<AdminLayout />}>
      <Route path="/admin" element={<AdminDashboard />} />
      <Route path="/admin/broadcast" element={<BroadcastPage />} />
    </Route>
  </Route>

</Routes>
```

## **5. Coding Guidelines for Contributors**

### **A. How to Create a New Feature**

If you are assigned the task **"Build the Khutbah List"**:

1. Go to `src/features/dawah/`.  
2. Create `api/dawahApi.js` -> Function to fetch data via Axios.  
3. Create `hooks/useKhutbahs.js` -> Use useQuery to call the API.  
4. Create `components/KhutbahList.jsx` -> Use the hook to get data, render the UI.  
5. Go to `src/pages/student/KhutbahsPage.jsx` -> Import and place `<KhutbahList />`.

### **B. Naming Conventions**

* **Components:** `PascalCase.jsx` (e.g., AudioPlayer.jsx)  
* **Hooks:** `camelCase.js` (must start with 'use', for example, useFetchData.js)  
* **Helper Functions:** `camelCase.js` (e.g, formatDate.js)


### **C. Example Code Pattern**

This is an example of the coing standard we'd like to adapt in this project. Endeavour to make your implementations
follow a pattern similar to this so we can have a uniform codebase (and less fight during code reviews).

**1. The API Layer (features/dawah/api/dawahApi.js)**

```jsx
import axios from '@/lib/axios';


export const getKhutbahs = async () => {
  const { data } = await axios.get('/content/khutbahs');
  return data;

};
```

**2. The Hook Layer (features/dawah/hooks/useKhutbahs.js)**

```jsx
import { useQuery } from '@tanstack/react-query';
import { getKhutbahs } from '../api/dawahApi';


export const useKhutbahs = () => {

  return useQuery({
    queryKey: ['khutbahs'],
    queryFn: getKhutbahs,
    staleTime: 1000 * 60 * 5,
  });

};
```

**3. The Component Layer (features/dawah/components/KhutbahList.jsx)**

```jsx
import { useKhutbahs } from '../hooks/useKhutbahs';


const KhutbahList = () => {

  const { data, isLoading, error } = useKhutbahs();
  if (isLoading) return <p>Loading lectures...</p>;
  if (error) return <p>Error loading content.</p>;
  return (
    <ul>
      {data.map((k) => (
        <li key={k.id}>{k.title}</li>
      ))}
    </ul>
  );
};
```