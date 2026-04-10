// AuthPage.jsx - Updated with image upload support
import { useState, useRef } from 'react';
import { register, login, checkUsername, checkEmail, validateRegistration } from '../services/auth';
import { FiX, FiUpload } from 'react-icons/fi';

// --- Reusable Sub-Components ---

// 1. Primary Button (Solid Orange)
const PrimaryButton = ({ label, onClick, type = "button", disabled = false }) => (
  <button 
    type={type}
    onClick={onClick}
    disabled={disabled}
    className={`w-full bg-[#ff7b57] hover:bg-[#e96e4c] text-black font-bold py-3.5 px-4 rounded-full text-sm transition-colors duration-200 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
  >
    {label}
  </button>
);

// 2. Input Field with error handling
const InputField = ({ label, type = "text", placeholder, name, value, onChange, onBlur, error, required = false }) => (
  <div className="w-full mb-5">
    <label className="block text-white text-xs font-semibold mb-2 ml-1">
      {label} {required && <span className="text-[#ff7b57]">*</span>}
    </label>
    <input 
      type={type} 
      name={name}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      className={`w-full bg-black/40 text-white placeholder:text-zinc-600 border ${error ? 'border-red-500' : 'border-zinc-800'} focus:border-[#ff7b57] focus:ring-1 focus:ring-[#ff7b57] rounded-full py-3 px-6 text-sm outline-none transition`}
    />
    {error && <p className="text-red-500 text-xs mt-1 ml-4">{error}</p>}
  </div>
);

// 3. Social Button (Outline with Icon)
const SocialButton = ({ label, icon, onClick }) => (
  <button 
    onClick={onClick}
    className="w-full bg-transparent hover:bg-zinc-900 text-white border border-zinc-800 rounded-full py-3.5 px-4 flex items-center justify-center gap-3 text-sm transition-colors duration-200"
  >
    <span className="text-lg">{icon}</span>
    {label}
  </button>
);

// 4. Auth Header (Title and Subtitle)
const AuthHeader = ({ title, subtitle }) => (
  <div className="text-center mb-8">
    <div className="bg-[#ff7b57] w-14 h-14 rounded-full flex items-center justify-center font-bold text-3xl mb-5 mx-auto text-black">
      A
    </div>
    <h1 className="text-3xl font-extrabold text-white mb-2">{title}</h1>
    <p className="text-zinc-400 text-sm font-medium">{subtitle}</p>
  </div>
);

// 5. Section Divider ("OR")
const Divider = () => (
  <div className="relative flex items-center w-full my-8">
    <div className="grow border-t border-zinc-800"></div>
    <span className="shrink mx-4 text-xs font-bold text-zinc-500">OR</span>
    <div className="grow border-t border-zinc-800"></div>
  </div>
);

// 6. Country Select Dropdown
const CountrySelect = ({ label, name, value, onChange, error, required = false }) => {
  const africaCountries = [
    { code: 'DZ', name: 'Algeria' }, { code: 'AO', name: 'Angola' }, { code: 'BJ', name: 'Benin' },
    { code: 'BW', name: 'Botswana' }, { code: 'BF', name: 'Burkina Faso' }, { code: 'BI', name: 'Burundi' },
    { code: 'CV', name: 'Cabo Verde' }, { code: 'CM', name: 'Cameroon' }, { code: 'CF', name: 'Central African Republic' },
    { code: 'TD', name: 'Chad' }, { code: 'KM', name: 'Comoros' }, { code: 'CD', name: 'Congo' },
    { code: 'DJ', name: 'Djibouti' }, { code: 'EG', name: 'Egypt' }, { code: 'GQ', name: 'Equatorial Guinea' },
    { code: 'ER', name: 'Eritrea' }, { code: 'SZ', name: 'Eswatini' }, { code: 'ET', name: 'Ethiopia' },
    { code: 'GA', name: 'Gabon' }, { code: 'GM', name: 'Gambia' }, { code: 'GH', name: 'Ghana' },
    { code: 'GN', name: 'Guinea' }, { code: 'GW', name: 'Guinea-Bissau' }, { code: 'CI', name: 'Côte d\'Ivoire' },
    { code: 'KE', name: 'Kenya' }, { code: 'LS', name: 'Lesotho' }, { code: 'LR', name: 'Liberia' },
    { code: 'LY', name: 'Libya' }, { code: 'MG', name: 'Madagascar' }, { code: 'MW', name: 'Malawi' },
    { code: 'ML', name: 'Mali' }, { code: 'MR', name: 'Mauritania' }, { code: 'MU', name: 'Mauritius' },
    { code: 'MA', name: 'Morocco' }, { code: 'MZ', name: 'Mozambique' }, { code: 'NA', name: 'Namibia' },
    { code: 'NE', name: 'Niger' }, { code: 'NG', name: 'Nigeria' }, { code: 'RW', name: 'Rwanda' },
    { code: 'ST', name: 'Sao Tome and Principe' }, { code: 'SN', name: 'Senegal' }, { code: 'SC', name: 'Seychelles' },
    { code: 'SL', name: 'Sierra Leone' }, { code: 'SO', name: 'Somalia' }, { code: 'ZA', name: 'South Africa' },
    { code: 'SS', name: 'South Sudan' }, { code: 'SD', name: 'Sudan' }, { code: 'TZ', name: 'Tanzania' },
    { code: 'TG', name: 'Togo' }, { code: 'TN', name: 'Tunisia' }, { code: 'UG', name: 'Uganda' },
    { code: 'ZM', name: 'Zambia' }, { code: 'ZW', name: 'Zimbabwe' }
  ];

  return (
    <div className="w-full mb-5">
      <label className="block text-white text-xs font-semibold mb-2 ml-1">
        {label} {required && <span className="text-[#ff7b57]">*</span>}
      </label>
      <select
        name={name}
        value={value}
        onChange={onChange}
        className={`w-full bg-black/40 text-white placeholder:text-zinc-600 border ${error ? 'border-red-500' : 'border-zinc-800'} focus:border-[#ff7b57] focus:ring-1 focus:ring-[#ff7b57] rounded-full py-3 px-6 text-sm outline-none transition`}
      >
        <option value="">Select Country</option>
        {africaCountries.map(country => (
          <option key={country.code} value={country.code}>
            {country.name}
          </option>
        ))}
      </select>
      {error && <p className="text-red-500 text-xs mt-1 ml-4">{error}</p>}
    </div>
  );
};

// 7. Image Upload Component
const ImageUpload = ({ label, onImageSelect, previewUrl, onRemove, error }) => {
  const inputRef = useRef(null);

  return (
    <div className="w-full mb-5">
      <label className="block text-white text-xs font-semibold mb-2 ml-1">
        {label}
      </label>
      {previewUrl ? (
        <div className="relative">
          <img 
            src={previewUrl} 
            alt={label}
            className="w-full h-32 object-cover rounded-xl"
          />
          <button
            type="button"
            onClick={onRemove}
            className="absolute top-2 right-2 bg-black/70 hover:bg-black rounded-full p-1 transition"
          >
            <FiX className="text-white" size={16} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full bg-black/40 border border-dashed border-zinc-700 hover:border-[#ff7b57] rounded-xl py-6 flex flex-col items-center gap-2 transition"
        >
          <FiUpload className="text-zinc-400 text-2xl" />
          <span className="text-zinc-400 text-sm">Click to upload {label.toLowerCase()}</span>
          <span className="text-zinc-600 text-xs">Max 5MB</span>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={onImageSelect}
        className="hidden"
      />
      {error && <p className="text-red-500 text-xs mt-1 ml-4">{error}</p>}
    </div>
  );
};

// --- LOGIN FORM COMPONENT ---
const LoginForm = ({ onSuccess }) => {
  const [formData, setFormData] = useState({
    identifier: '',
    password: '',
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [generalError, setGeneralError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
    setGeneralError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.identifier || !formData.password) {
      setErrors({
        identifier: formData.identifier ? '' : 'Email/Username/Phone is required',
        password: formData.password ? '' : 'Password is required',
      });
      return;
    }

    setLoading(true);
    setGeneralError('');

    try {
      const credentials = {};
      if (formData.identifier.includes('@')) {
        credentials.email = formData.identifier;
      } else if (formData.identifier.match(/^\+?[0-9]+$/)) {
        credentials.phone_number = formData.identifier;
      } else {
        credentials.username = formData.identifier;
      }
      credentials.password = formData.password;

      const result = await login(credentials);
      console.log('Login successful:', result);
      
      if (onSuccess) {
        onSuccess(result.user);
      }
    } catch (error) {
      console.error('Login error:', error);
      if (error.data?.errors) {
        setErrors(error.data.errors);
      } else if (error.data?.non_field_errors) {
        setGeneralError(error.data.non_field_errors[0]);
      } else {
        setGeneralError(error.message || 'Login failed. Please check your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {generalError && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500 rounded-lg">
          <p className="text-red-500 text-sm text-center">{generalError}</p>
        </div>
      )}
      
      <InputField 
        label="Email, Username or Phone Number" 
        type="text" 
        placeholder="Enter your email, username or phone number"
        name="identifier"
        value={formData.identifier}
        onChange={handleChange}
        error={errors.identifier}
        required
      />
      
      <InputField 
        label="Password" 
        type="password" 
        placeholder="Enter your password"
        name="password"
        value={formData.password}
        onChange={handleChange}
        error={errors.password}
        required
      />

      <div className="text-left mb-6">
        <a href="#" className="text-xs text-zinc-400 hover:text-zinc-200 font-semibold underline">
          Forgot your password?
        </a>
      </div>

      <PrimaryButton label={loading ? "Logging in..." : "Log in"} type="submit" disabled={loading} />
    </form>
  );
};

// --- SIGNUP FORM COMPONENT WITH IMAGE UPLOADS ---
const SignupForm = ({ onSuccess }) => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirm_password: '',
    full_name: '',
    date_of_birth: '',
    phone_number: '',
    country: '',
    city: '',
  });
  const [profilePicture, setProfilePicture] = useState(null);
  const [coverPhoto, setCoverPhoto] = useState(null);
  const [profilePreview, setProfilePreview] = useState(null);
  const [coverPreview, setCoverPreview] = useState(null);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [generalError, setGeneralError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
    setGeneralError('');
  };

  const handleProfilePictureSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setErrors(prev => ({ ...prev, profile_picture: 'Profile picture must be less than 5MB' }));
        return;
      }
      setProfilePicture(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePreview(reader.result);
      };
      reader.readAsDataURL(file);
      if (errors.profile_picture) {
        setErrors(prev => ({ ...prev, profile_picture: '' }));
      }
    }
  };

  const handleCoverPhotoSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setErrors(prev => ({ ...prev, cover_photo: 'Cover photo must be less than 10MB' }));
        return;
      }
      setCoverPhoto(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setCoverPreview(reader.result);
      };
      reader.readAsDataURL(file);
      if (errors.cover_photo) {
        setErrors(prev => ({ ...prev, cover_photo: '' }));
      }
    }
  };

  const removeProfilePicture = () => {
    setProfilePicture(null);
    setProfilePreview(null);
  };

  const removeCoverPhoto = () => {
    setCoverPhoto(null);
    setCoverPreview(null);
  };

  const handleBlur = async (e) => {
    const { name, value } = e.target;
    
    if (name === 'username' && value && value.length >= 3) {
      try {
        const result = await checkUsername(value);
        if (!result.available) {
          setErrors(prev => ({ ...prev, username: 'Username is already taken' }));
        }
      } catch (error) {
        console.error('Username check error:', error);
      }
    }
    
    if (name === 'email' && value && value.includes('@')) {
      try {
        const result = await checkEmail(value);
        if (!result.available) {
          setErrors(prev => ({ ...prev, email: 'Email is already registered' }));
        }
      } catch (error) {
        console.error('Email check error:', error);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const validation = validateRegistration(formData);
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }
    
    setLoading(true);
    setGeneralError('');

    try {
      // Create FormData for multipart upload
      const formDataToSend = new FormData();
      
      // Add all text fields
      Object.keys(formData).forEach(key => {
        if (formData[key]) {
          formDataToSend.append(key, formData[key]);
        }
      });
      
      // Add images if they exist
      if (profilePicture) {
        formDataToSend.append('profile_picture', profilePicture);
      }
      if (coverPhoto) {
        formDataToSend.append('cover_photo', coverPhoto);
      }
      
      // Use the register function (need to update it to handle FormData)
      const result = await register(formDataToSend);
      console.log('Registration successful:', result);
      
      if (onSuccess) {
        onSuccess(result.user);
      }
    } catch (error) {
      console.error('Registration error:', error);
      if (error.data?.errors) {
        setErrors(error.data.errors);
      } else if (error.data?.non_field_errors) {
        setGeneralError(error.data.non_field_errors[0]);
      } else {
        setGeneralError(error.message || 'Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {generalError && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500 rounded-lg">
          <p className="text-red-500 text-sm text-center">{generalError}</p>
        </div>
      )}
      
      {/* Image Uploads Section */}
      <div className="mb-6 p-4 bg-zinc-900/50 rounded-2xl border border-zinc-800">
        <h3 className="text-white text-sm font-semibold mb-3">Profile Images (Optional)</h3>
        <ImageUpload 
          label="Profile Picture"
          onImageSelect={handleProfilePictureSelect}
          previewUrl={profilePreview}
          onRemove={removeProfilePicture}
          error={errors.profile_picture}
        />
        <ImageUpload 
          label="Cover Photo"
          onImageSelect={handleCoverPhotoSelect}
          previewUrl={coverPreview}
          onRemove={removeCoverPhoto}
          error={errors.cover_photo}
        />
      </div>
      
      <InputField 
        label="Username" 
        type="text" 
        placeholder="Choose a username"
        name="username"
        value={formData.username}
        onChange={handleChange}
        onBlur={handleBlur}
        error={errors.username}
        required
      />
      
      <InputField 
        label="Email" 
        type="email" 
        placeholder="Enter your email"
        name="email"
        value={formData.email}
        onChange={handleChange}
        onBlur={handleBlur}
        error={errors.email}
        required
      />
      
      <InputField 
        label="Full Name" 
        type="text" 
        placeholder="Your full name"
        name="full_name"
        value={formData.full_name}
        onChange={handleChange}
        error={errors.full_name}
        required
      />
      
      <InputField 
        label="Date of Birth" 
        type="date" 
        placeholder="YYYY-MM-DD"
        name="date_of_birth"
        value={formData.date_of_birth}
        onChange={handleChange}
        error={errors.date_of_birth}
        required
      />
      
      <InputField 
        label="Phone Number" 
        type="tel" 
        placeholder="+254712345678"
        name="phone_number"
        value={formData.phone_number}
        onChange={handleChange}
        error={errors.phone_number}
        required
      />
      
      <CountrySelect 
        label="Country"
        name="country"
        value={formData.country}
        onChange={handleChange}
        error={errors.country}
        required
      />
      
      <InputField 
        label="City" 
        type="text" 
        placeholder="Your city"
        name="city"
        value={formData.city}
        onChange={handleChange}
        error={errors.city}
        required
      />
      
      <InputField 
        label="Password" 
        type="password" 
        placeholder="Create a password (min. 8 characters)"
        name="password"
        value={formData.password}
        onChange={handleChange}
        error={errors.password}
        required
      />
      
      <InputField 
        label="Confirm Password" 
        type="password" 
        placeholder="Confirm your password"
        name="confirm_password"
        value={formData.confirm_password}
        onChange={handleChange}
        error={errors.confirm_password}
        required
      />

      <PrimaryButton label={loading ? "Creating Account..." : "Create account"} type="submit" disabled={loading} />
    </form>
  );
};

// --- MAIN AUTH PAGE COMPONENT ---
const AuthPage = () => {
  const [showLogin, setShowLogin] = useState(true);
  const [authSuccess, setAuthSuccess] = useState(false);

  const handleAuthSuccess = () => {
    setAuthSuccess(true);
    setTimeout(() => {
      window.location.href = '/dashboard';
    }, 1500);
  };

  if (authSuccess) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center font-sans p-6">
        <div className="relative z-10 w-full max-w-md bg-[#131313] rounded-3xl p-12 border border-zinc-900 shadow-2xl text-center">
          <div className="bg-green-500/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Success!</h2>
          <p className="text-zinc-400">
            {showLogin ? 'Login successful! Redirecting...' : 'Account created successfully! Redirecting...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center font-sans p-6">
      <div className="absolute inset-0 opacity-10 flex gap-10 overflow-hidden scale-110">
        <img src="https://picsum.photos/400/600" className="object-cover" alt="" />
        <img src="https://picsum.photos/400/500" className="object-cover" alt="" />
        <img src="https://picsum.photos/400/800" className="object-cover" alt="" />
      </div>

      <div className="relative z-10 w-full max-w-md bg-[#131313] rounded-3xl p-12 border border-zinc-900 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
        
        <AuthHeader 
          title={`Welcome to Afriq`} 
          subtitle={`Discover African art, fashion, and culture.`} 
        />

        <div className="w-full bg-black/40 rounded-full flex p-1 mb-8 border border-zinc-800">
          <button 
            onClick={() => setShowLogin(true)}
            className={`flex-1 text-sm font-semibold py-3 px-6 rounded-full transition-colors duration-200 ${showLogin ? 'bg-zinc-100 text-black' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            Log in
          </button>
          <button 
            onClick={() => setShowLogin(false)}
            className={`flex-1 text-sm font-semibold py-3 px-6 rounded-full transition-colors duration-200 ${showLogin ? 'text-zinc-400 hover:text-zinc-200' : 'bg-zinc-100 text-black'}`}
          >
            Sign up
          </button>
        </div>

        {showLogin ? (
          <LoginForm onSuccess={handleAuthSuccess} />
        ) : (
          <SignupForm onSuccess={handleAuthSuccess} />
        )}

        <Divider />

        <div className="w-full flex flex-col gap-4">
          <SocialButton label="Continue with Google" icon="G" onClick={() => {}} />
          <SocialButton label="Continue with Apple" icon="" onClick={() => {}} />
        </div>

      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #1a1a1a;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #ff7b57;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #e96e4c;
        }
      `}</style>
    </div>
  );
};

export default AuthPage;