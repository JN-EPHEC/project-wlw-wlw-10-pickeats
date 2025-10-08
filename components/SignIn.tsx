type Credentials = {
  username: string;
  password: string;
};

function signIn({ username, password }: Credentials): string {
  const validUsername = "admin";
  const validPassword = "1234";

  if (username === validUsername && password === validPassword) {
    return "Sign-in successful!";
  } else {
    return "Invalid username or password.";
  }
}