// SPLASH SCREEN
setTimeout(() => {
    document.getElementById("splash").style.display = "none";
    document.getElementById("loginBox").classList.remove("hidden");
}, 2000);

// SWITCH FORMS
function showLogin() {
    document.getElementById("loginForm").classList.remove("hidden");
    document.getElementById("registerForm").classList.add("hidden");
}

function showRegister() {
    document.getElementById("registerForm").classList.remove("hidden");
    document.getElementById("loginForm").classList.add("hidden");
}

async function registerUser() {
    const user = document.getElementById("regUser").value;
    const pass = document.getElementById("regPass").value;

    const res = await fetch("http://localhost:3000/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user, pass })
    });

    alert(await res.text());
}

async function loginUser() {
    const user = document.getElementById("loginUser").value;
    const pass = document.getElementById("loginPass").value;

    const res = await fetch("http://localhost:3000/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user, pass })
    });

    const msg = await res.text();
    alert(msg);

    if (msg === "Login success") {
        localStorage.setItem("user", user);
        window.location.href = "main.html";
    }
}